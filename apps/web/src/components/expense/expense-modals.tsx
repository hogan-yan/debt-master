import { Clock } from 'lucide-react';
import { ExpenseForm } from '@/components/forms/expense-form';
import { Button } from '@/components/ui/button';
import { CRUDModalContainer } from '@/components/ui/crud-modal-container';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseDeleteDialog } from '@/components/ui/expense-delete-dialog';
import { m } from '@/paraglide/messages';
import { EXPENSE, PAYMENT_CLAIM } from '@/test/test-ids';
import { Expense, SplitType } from '@/types';
import { AdminOnly } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';

export function mapExpenseParticipantIds(
  participants: Array<{ colleagueId: number }> | null | undefined
): number[] {
  return participants?.map((p) => p.colleagueId) || [];
}

export function mapExpenseParticipants<T>(participants: T[] | null | undefined): T[] {
  return participants || [];
}

interface ExpenseModalsProps {
  /** Modal states */
  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  isReceiptModalOpen: boolean;
  isClaimModalOpen: boolean;
  /** Modal state setters */
  setIsAddModalOpen: (open: boolean) => void;
  setIsEditModalOpen: (open: boolean) => void;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setIsReceiptModalOpen: (open: boolean) => void;
  setIsClaimModalOpen: (open: boolean) => void;
  /** Data for modals */
  selectedExpense: Expense | null;
  expenseToDelete: Expense | null;
  selectedParticipant: {
    id: number;
    amount: number;
    colleague?: {
      id: number;
      name: string;
    };
  } | null;
  receiptUrl: string | null;
  colleagues: Array<{ id: number; name: string }>;
  restaurants: Array<{ id: number; name: string; address?: string | null }>;
  /** Action handlers */
  onCreateExpense: (formData: {
    date: string;
    restaurantId: number;
    amount: number;
    splitType: SplitType;
    participantIds: number[];
    items?: Array<{ name?: string; price: number; colleagueId: number }> | undefined;
    notes?: string | undefined;
    receiptFile?: File | undefined;
    removeExistingReceipt?: boolean | undefined;
    pendingClaimsChoice?: 'keep' | 'cancel' | 'adjust' | undefined;
  }) => Promise<void>;
  onEditExpense: (formData: {
    date: string;
    restaurantId: number;
    amount: number;
    splitType: SplitType;
    participantIds: number[];
    items?: Array<{ name?: string; price: number; colleagueId: number }> | undefined;
    notes?: string | undefined;
    receiptFile?: File | undefined;
    removeExistingReceipt?: boolean | undefined;
    pendingClaimsChoice?: 'keep' | 'cancel' | 'adjust' | undefined;
  }) => Promise<void>;
  onDeleteConfirm: (deletePayments: boolean) => Promise<void>;
  onClaimPaymentWithProof: (participantId: number, file?: File, method?: string) => Promise<void>;
  /** Processing states */
  isProcessingPaymentClaim: Record<number, boolean>;
  /** Additional props for enhanced delete dialog */
  hasRelatedPayments?: boolean;
  isDeleting?: boolean;
}

/**
 * Container component for all expense-related modals
 * Centralizes modal management and reduces main component complexity
 */
export const ExpenseModals = ({
  isAddModalOpen,
  isEditModalOpen,
  isDeleteDialogOpen,
  isReceiptModalOpen,
  isClaimModalOpen,
  setIsAddModalOpen,
  setIsEditModalOpen,
  setIsDeleteDialogOpen,
  setIsReceiptModalOpen,
  setIsClaimModalOpen,
  selectedExpense,
  expenseToDelete,
  selectedParticipant,
  receiptUrl,
  colleagues,
  restaurants,
  onCreateExpense,
  onEditExpense,
  onDeleteConfirm,
  onClaimPaymentWithProof,
  isProcessingPaymentClaim,
  hasRelatedPayments,
  isDeleting,
}: ExpenseModalsProps) => {
  return (
    <>
      {/* Add Expense Modal - Admin Only */}
      <AdminOnly>
        <CRUDModalContainer
          isOpen={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          title={m.expense_form_addNewExpense()}
          maxWidth="2xl"
          data-testid={EXPENSE.ADD_EXPENSE_DIALOG}
        >
          <ExpenseForm
            colleagues={colleagues}
            restaurants={restaurants}
            onClose={() => setIsAddModalOpen(false)}
            onSubmit={onCreateExpense}
          />
        </CRUDModalContainer>
      </AdminOnly>

      {/* Edit Expense Modal - Admin Only */}
      <AdminOnly>
        <CRUDModalContainer
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          title={m.expense_detail_editExpense()}
          maxWidth="2xl"
          data-testid={EXPENSE.EDIT_EXPENSE_DIALOG}
        >
          {selectedExpense && (
            <ExpenseForm
              colleagues={colleagues}
              restaurants={restaurants}
              onClose={() => setIsEditModalOpen(false)}
              onSubmit={onEditExpense}
              initialData={{
                id: selectedExpense.id,
                date:
                  typeof selectedExpense.date === 'string'
                    ? selectedExpense.date
                    : selectedExpense.date.toISOString().split('T')[0],
                restaurantId: selectedExpense.restaurantId,
                amount: selectedExpense.amount,
                splitType: selectedExpense.splitType as SplitType,
                participantIds: mapExpenseParticipantIds(selectedExpense.participants),
                notes: selectedExpense.notes || undefined,
                items: selectedExpense.items?.map((item) => ({
                  name: item.name,
                  price: item.price,
                  colleagueId: item.colleagueId,
                })),
                participants: mapExpenseParticipants(selectedExpense.participants),
                existingReceiptBucket: selectedExpense.receiptBucket,
                existingReceiptObjectKey: selectedExpense.receiptObjectKey,
              }}
            />
          )}
        </CRUDModalContainer>
      </AdminOnly>

      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-4xl" data-testid={EXPENSE.RECEIPT_MODAL}>
          <DialogHeader>
            <DialogTitle>{m.expense_detail_receipt()}</DialogTitle>
          </DialogHeader>

          {receiptUrl && (
            <div className="space-y-4">
              <img
                src={receiptUrl}
                alt={m.expense_detail_receiptImageAlt()}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg border"
                data-testid={EXPENSE.RECEIPT_MODAL_IMAGE}
              />
              <div className="flex justify-end">
                <Button onClick={() => window.open(receiptUrl, '_blank')} variant="outline">
                  {m.expense_detail_openInNewTab()}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - Admin Only */}
      <AdminOnly>
        <ExpenseDeleteDialog
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          expense={expenseToDelete}
          onConfirm={onDeleteConfirm}
          isLoading={isDeleting}
          hasRelatedPayments={hasRelatedPayments}
        />
      </AdminOnly>

      {/* Claim Payment with Proof Modal */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid={PAYMENT_CLAIM.DIALOG}>
          <DialogHeader>
            <DialogTitle>{m.payment_modal_title()}</DialogTitle>
          </DialogHeader>

          {selectedParticipant && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>{m.expense_modal_amountLabel()}</strong>{' '}
                  {formatCurrency(selectedParticipant.amount)}
                </p>
                <p>
                  <strong>{m.expense_modal_forLabel()}</strong>{' '}
                  {selectedParticipant.colleague?.name || m.common_unknown()}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="paymentMethod"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {m.payment_modal_paymentMethod()}
                  </label>
                  <select
                    id="paymentMethod"
                    data-testid={PAYMENT_CLAIM.PAYMENT_METHOD_SELECT}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    defaultValue="PAYME"
                  >
                    <option value="PAYME">{m.payment_modal_payme()}</option>
                    <option value="FPS">{m.payment_modal_fps()}</option>
                    <option value="CASH">{m.payment_modal_cash()}</option>
                    <option value="OTHER">{m.payment_modal_other()}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="paymentProofFile"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {m.expense_modal_paymentProofOptional()}
                  </label>
                  <input
                    type="file"
                    id="paymentProofFile"
                    data-testid={PAYMENT_CLAIM.PAYMENT_PROOF_INPUT}
                    accept="image/*"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {m.expense_modal_uploadProofDescription()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsClaimModalOpen(false);
                  }}
                >
                  {m.common_cancel()}
                </Button>
                <Button
                  data-testid={PAYMENT_CLAIM.SUBMIT_BTN}
                  onClick={() => {
                    const paymentMethodSelect = document.getElementById(
                      'paymentMethod'
                    ) as HTMLSelectElement;
                    const paymentProofInput = document.getElementById(
                      'paymentProofFile'
                    ) as HTMLInputElement;

                    const paymentMethod = paymentMethodSelect.value as
                      | 'PAYME'
                      | 'FPS'
                      | 'CASH'
                      | 'OTHER';
                    const paymentProofFile = paymentProofInput.files?.[0];

                    onClaimPaymentWithProof(
                      selectedParticipant.id,
                      paymentProofFile,
                      paymentMethod
                    );
                  }}
                  disabled={isProcessingPaymentClaim[selectedParticipant.id]}
                  className="bg-info hover:bg-info text-white"
                >
                  {isProcessingPaymentClaim[selectedParticipant.id] ? (
                    <>
                      <Clock className="h-3 w-3 mr-1 animate-spin" />
                      {m.payment_modal_submitting()}
                    </>
                  ) : (
                    m.payment_modal_markAsPaid()
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
