/**
 * ExpenseForm component for creating and editing expenses
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFormSubmission } from '@/hooks';
import { type CreateExpenseSchema, expenseSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { EXPENSE_FORM, participantCheckboxId } from '@/test/test-ids';
import { Colleague, Restaurant, SplitType } from '@/types';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { DialogFooter } from '../ui/dialog';
import { ExpenseEditWarningModal } from '../ui/expense-edit-warning-modal';
import { Form } from '../ui/form';
import { FormInput, FormSelect, FormTextarea } from '../ui/form-fields';
import { Label } from '../ui/label';
import { createExpenseFieldValidator } from './expense-validation';
import { InlineColleagueCreator } from './inline-colleague-creator';
import { ItemizedSplitSection } from './itemized-split-section';
import { PaymentWarningBanner } from './payment-warning-banner';
import { ReceiptUploadSection } from './receipt-upload-section';
import { SplitTypeSelector } from './split-type-selector';
import { type ParticipantWithPayments, usePaymentImpact } from './use-payment-impact';
import { usePendingClaims } from './use-pending-claims';
import { type PersonItems, usePersonItems } from './use-person-items';

export interface ExpenseItem {
  name?: string;
  price: number;
  colleagueId: number;
}

interface ExpenseFormProps {
  colleagues: Colleague[];
  restaurants: Restaurant[];
  onClose: () => void;
  onSubmit: (data: {
    date: string;
    restaurantId: number;
    amount: number;
    splitType: SplitType;
    participantIds: number[];
    items?: ExpenseItem[] | undefined;
    notes?: string | undefined;
    receiptFile?: File | undefined;
    removeExistingReceipt?: boolean | undefined;
    pendingClaimsChoice?: 'keep' | 'cancel' | 'adjust' | undefined;
  }) => Promise<void>;
  initialData?: {
    id?: number | undefined;
    date?: string | undefined;
    restaurantId?: number | undefined;
    amount?: number | undefined;
    splitType?: SplitType | undefined;
    participantIds?: number[] | undefined;
    notes?: string | undefined;
    items?: Array<{ name: string; price: number; colleagueId: number }> | undefined;
    participants?: ParticipantWithPayments[] | undefined;
    existingReceiptBucket?: string | null | undefined;
    existingReceiptObjectKey?: string | null | undefined;
  };
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  colleagues,
  restaurants,
  onClose,
  onSubmit,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess: () => onClose(),
    successTitle: isEditing ? m.expense_form_expenseUpdated() : m.expense_form_expenseCreated(),
    successMessage: isEditing
      ? m.expense_form_expenseUpdatedMessage()
      : m.expense_form_expenseCreatedMessage(),
    errorTitle: isEditing ? m.expense_form_failedToUpdate() : m.expense_form_failedToCreate(),
  });

  // Receipt state tracked via refs from ReceiptUploadSection
  const receiptFileRef = useRef<File | null>(null);
  const keepExistingReceiptRef = useRef(true);
  const existingReceiptUrlRef = useRef<string | null>(null);
  const [isReceiptProcessing, setIsReceiptProcessing] = useState(false);

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    initialData?.participantIds?.map((id) => id.toString()) ?? []
  );
  const [splitType, setSplitType] = useState<SplitType>(initialData?.splitType ?? 'ITEMIZED');

  const [addedColleagues, setAddedColleagues] = useState<Colleague[]>([]);
  const allColleagues = useMemo<Colleague[]>(() => {
    if (addedColleagues.length === 0) return colleagues;
    const seen = new Set(colleagues.map((c) => c.id));
    return [...colleagues, ...addedColleagues.filter((c) => !seen.has(c.id))];
  }, [colleagues, addedColleagues]);

  const initialPersonItems = (): PersonItems[] | undefined => {
    if (!initialData?.items || initialData.splitType !== 'ITEMIZED') return undefined;
    let counter = 0;
    return initialData.items.reduce<PersonItems[]>((grouped, item) => {
      const existing = grouped.find((p) => p.colleagueId === item.colleagueId);
      const personItem = { id: `item-${++counter}`, name: item.name || '', price: item.price };
      if (existing) {
        existing.items.push(personItem);
      } else {
        grouped.push({ colleagueId: item.colleagueId, items: [personItem] });
      }
      return grouped;
    }, []);
  };
  const { personItems, togglePerson, addItem, removeItem, updateItem } = usePersonItems(
    initialPersonItems()
  );

  const handleColleagueCreated = useCallback(
    (created: { id: number; name: string }): void => {
      setAddedColleagues((prev) => [...prev, { id: created.id, name: created.name }]);

      if (splitType === 'EQUAL') {
        const idString = created.id.toString();
        setSelectedParticipants((prev) => [...prev, idString]);
      } else {
        togglePerson(created.id);
      }
    },
    [splitType, togglePerson]
  );

  const { hasExistingPayments, showPaymentWarning, confirmEdit, paymentImpacts, setConfirmEdit } =
    usePaymentImpact({ isEditing, participants: initialData?.participants });

  const {
    pendingClaims,
    pendingSubmissionData,
    showWarningModal,
    pendingClaimsChoice,
    checkPendingClaims,
    handleWarningConfirm,
    setShowWarningModal,
  } = usePendingClaims({ isEditing, expenseId: initialData?.id });

  const handleReceiptChange = useCallback((file: File | null) => {
    receiptFileRef.current = file;
  }, []);
  const handleKeepExistingChange = useCallback((keep: boolean) => {
    keepExistingReceiptRef.current = keep;
  }, []);
  const handleReceiptProcessingChange = useCallback((processing: boolean) => {
    setIsReceiptProcessing(processing);
  }, []);
  const handleExistingUrlChange = useCallback((url: string | null) => {
    existingReceiptUrlRef.current = url;
  }, []);

  const handleFormSubmit = async (values: CreateExpenseSchema): Promise<void> => {
    const restaurantId = Number.parseInt(values.restaurantId, 10);
    let participantIds: number[];
    let amount = 0;
    const itemsToSubmit: ExpenseItem[] = [];

    if (splitType === 'EQUAL') {
      amount = Number.parseFloat(values.amount);
      participantIds = selectedParticipants.map((id) => Number.parseInt(id, 10));

      if (participantIds.length === 0) {
        toast.error(m.expense_form_selectParticipantEqual());
        return;
      }
    } else {
      for (const person of personItems) {
        for (const item of person.items) {
          if (item.price > 0) {
            const trimmedName = item.name?.trim();
            const result: ExpenseItem = { price: item.price, colleagueId: person.colleagueId };
            if (trimmedName) {
              result.name = trimmedName;
            }
            itemsToSubmit.push(result);
          }
        }
      }

      if (itemsToSubmit.length === 0) {
        toast.error(m.expense_form_addItemItemized());
        return;
      }

      amount = itemsToSubmit.reduce((sum, item) => sum + item.price, 0);
      participantIds = [...new Set(itemsToSubmit.map((item) => item.colleagueId))];
    }

    if (hasExistingPayments && !confirmEdit) {
      toast.error(m.expense_form_confirmEditImpact());
      return;
    }

    const removeExistingReceipt = !!(
      existingReceiptUrlRef.current &&
      !keepExistingReceiptRef.current &&
      !receiptFileRef.current
    );

    const submissionData = {
      date: values.date,
      restaurantId,
      amount,
      splitType,
      participantIds,
      notes: values.notes,
      receiptFile: receiptFileRef.current ?? undefined,
      removeExistingReceipt,
      pendingClaimsChoice,
      ...(itemsToSubmit.length > 0 ? { items: itemsToSubmit } : {}),
    };

    if (checkPendingClaims(submissionData, amount, initialData?.amount)) {
      return;
    }

    await handleSubmit(
      async () => {
        await onSubmit(submissionData);
        return { success: true };
      },
      isEditing
        ? m.expense_toast_updated({ amount: `$${amount.toFixed(2)}` })
        : m.expense_toast_created({ amount: `$${amount.toFixed(2)}` })
    );
  };

  const onWarningConfirm = async (choice: 'keep' | 'cancel' | 'adjust'): Promise<void> => {
    await handleWarningConfirm(choice, onSubmit, handleSubmit, (data) =>
      m.expense_toast_updated({
        amount: `$${data.amount.toFixed(2)}`,
      })
    );
  };

  const validateDate = createExpenseFieldValidator((v) => expenseSchema.shape.date.safeParse(v));
  const validateRestaurantId = createExpenseFieldValidator((v) =>
    expenseSchema.shape.restaurantId.safeParse(v)
  );
  const validateAmount = createExpenseFieldValidator((v) =>
    expenseSchema.shape.amount.safeParse(v)
  );
  const validateNotes = createExpenseFieldValidator((v) => expenseSchema.shape.notes.safeParse(v));

  const handleParticipantChange = (colleagueId: string, checked: boolean): void => {
    setSelectedParticipants((prev) =>
      checked ? [...prev, colleagueId] : prev.filter((id) => id !== colleagueId)
    );
  };

  const restaurantOptions = restaurants.map((r) => ({ value: r.id.toString(), label: r.name }));

  return (
    <>
      <Form<CreateExpenseSchema>
        defaultValues={{
          date: initialData?.date ?? new Date().toISOString().split('T')[0],
          restaurantId: initialData?.restaurantId?.toString() ?? '',
          amount: splitType === 'EQUAL' ? (initialData?.amount?.toString() ?? '') : '',
          splitType: initialData?.splitType ?? 'ITEMIZED',
          participantIds: [] satisfies string[],
          notes: initialData?.notes ?? '',
        }}
        onSubmit={handleFormSubmit}
        className="space-y-6"
      >
        {/* Payment Warning Section */}
        {showPaymentWarning && hasExistingPayments && (
          <PaymentWarningBanner
            paymentImpacts={paymentImpacts}
            confirmEdit={confirmEdit}
            onConfirmChange={(checked) => setConfirmEdit(checked)}
          />
        )}

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-4 py-4 px-0.5">
            <FormInput
              name="date"
              label={m.expense_form_label_date()}
              type="date"
              required
              validate={validateDate}
              data-testid={EXPENSE_FORM.DATE_INPUT}
            />

            <FormSelect
              name="restaurantId"
              label={m.expense_form_label_restaurant()}
              placeholder={m.expense_form_placeholder_restaurant()}
              options={restaurantOptions}
              required
              validate={validateRestaurantId}
              data-testid={EXPENSE_FORM.RESTAURANT_SELECT_BTN}
            />

            {splitType === 'EQUAL' && (
              <FormInput
                name="amount"
                label={m.expense_form_label_amount()}
                type="number"
                step="0.01"
                placeholder={m.expense_form_placeholder_amount()}
                required
                validate={validateAmount}
                data-testid={EXPENSE_FORM.AMOUNT_INPUT}
              />
            )}

            <SplitTypeSelector value={splitType} onChange={setSplitType} />

            {splitType === 'ITEMIZED' &&
              (allColleagues.length === 0 ? (
                <InlineColleagueCreator onCreated={handleColleagueCreated} />
              ) : (
                <ItemizedSplitSection
                  colleagues={allColleagues}
                  personItems={personItems}
                  togglePerson={togglePerson}
                  addItem={addItem}
                  removeItem={removeItem}
                  updateItem={updateItem}
                />
              ))}

            {splitType === 'EQUAL' && (
              <div className="grid gap-2">
                <Label>{m.expense_form_participants()}</Label>
                {allColleagues.length === 0 ? (
                  <InlineColleagueCreator onCreated={handleColleagueCreated} />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                      {allColleagues.map((colleague) => (
                        <div key={colleague.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`participant-${colleague.id}`}
                            checked={selectedParticipants.includes(colleague.id.toString())}
                            onCheckedChange={(checked) =>
                              handleParticipantChange(colleague.id.toString(), checked as boolean)
                            }
                            data-testid={participantCheckboxId(colleague.id)}
                          />
                          <Label htmlFor={`participant-${colleague.id}`}>{colleague.name}</Label>
                        </div>
                      ))}
                    </div>
                    {selectedParticipants.length === 0 && (
                      <p className="text-sm text-destructive-text">
                        {m.expense_form_participantRequired()}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <FormTextarea
              name="notes"
              label={m.expense_form_label_notes()}
              placeholder={m.expense_form_placeholder_notes()}
              validate={validateNotes}
            />

            {/* Receipt Upload Section */}
            <ReceiptUploadSection
              isEditing={isEditing}
              initialExpenseId={initialData?.id}
              existingReceiptBucket={initialData?.existingReceiptBucket}
              existingReceiptObjectKey={initialData?.existingReceiptObjectKey}
              onReceiptChange={handleReceiptChange}
              onKeepExistingChange={handleKeepExistingChange}
              onProcessingChange={handleReceiptProcessingChange}
              onExistingUrlChange={handleExistingUrlChange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid={EXPENSE_FORM.CANCEL_BTN}
          >
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isReceiptProcessing}
            data-testid={isEditing ? 'update-expense-btn' : 'create-expense-btn'}
          >
            {isSubmitting || isReceiptProcessing
              ? m.expense_edit_warning_processing()
              : isEditing
                ? m.expense_form_updateExpense()
                : m.expense_form_createExpense()}
          </Button>
        </DialogFooter>
      </Form>

      {/* Warning Modal for Pending Claims */}
      {showWarningModal && pendingSubmissionData && initialData?.amount && (
        <ExpenseEditWarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onConfirm={onWarningConfirm}
          currentAmount={initialData.amount}
          newAmount={pendingSubmissionData.amount}
          pendingClaims={pendingClaims}
          isProcessing={isSubmitting}
        />
      )}
    </>
  );
};
