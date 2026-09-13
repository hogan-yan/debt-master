/**
 * ColleagueForm component for adding and editing colleagues
 */

import React from 'react';
import { useFormSubmission } from '@/hooks';
import { type CreateColleagueSchema, colleagueSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { COLLEAGUE, COLLEAGUE_FORM } from '@/test/test-ids';
import { Button } from '../ui/button';
import { DialogFooter } from '../ui/dialog';
import { Form, FormSubmit } from '../ui/form';
import { FormInput } from '../ui/form-fields';

export function toastMessageForColleague(isEditing: boolean, name: string): string {
  return isEditing ? m.colleague_toast_updated({ name }) : m.colleague_toast_added({ name });
}

interface ColleagueFormProps {
  onClose: () => void;
  onSubmit: (data: CreateColleagueSchema) => Promise<void>;
  initialData?: Partial<CreateColleagueSchema>;
}

export const ColleagueForm: React.FC<ColleagueFormProps> = ({ onClose, onSubmit, initialData }) => {
  const isEditing = Boolean(initialData);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess: () => onClose(),
    successTitle: isEditing ? m.colleague_form_updatedSuccess() : m.colleague_form_addedSuccess(),
    successMessage: isEditing ? m.colleague_form_updatedMessage() : m.colleague_form_addedMessage(),
    errorTitle: isEditing ? m.colleague_form_updateFailed() : m.colleague_form_addFailed(),
  });

  const handleFormSubmit = async (values: CreateColleagueSchema) => {
    await handleSubmit(() => onSubmit(values), toastMessageForColleague(isEditing, values.name));
  };

  // Zod field validators
  const validateName = ({ value }: { value: string }) => {
    const result = colleagueSchema.shape.name.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  };

  return (
    <Form<CreateColleagueSchema>
      defaultValues={{
        name: initialData?.name || '',
      }}
      onSubmit={handleFormSubmit}
    >
      <div className="grid gap-4 py-4">
        <FormInput
          name="name"
          label={m.colleague_form_nameLabel()}
          placeholder={m.colleague_form_namePlaceholder()}
          required
          validate={validateName}
          data-testid={COLLEAGUE_FORM.NAME_INPUT}
        />
        {!isEditing && (
          <p className="text-sm text-muted-foreground">{m.colleague_form_zeroBalanceNote()}</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {m.common_cancel()}
        </Button>
        <FormSubmit disabled={isSubmitting} data-testid={COLLEAGUE.ADD_COLLEAGUE_BTN}>
          {isEditing ? m.colleague_form_updateButton() : m.colleague_form_addButton()}
        </FormSubmit>
      </DialogFooter>
    </Form>
  );
};
