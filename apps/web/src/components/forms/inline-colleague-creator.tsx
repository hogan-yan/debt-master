/**
 * Inline colleague creator used inside the expense form when no colleagues exist.
 * Lives outside the parent <Form> context, so it uses plain inputs/buttons.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { colleagueSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { createColleague } from '@/server/colleagues/handlers';
import { EXPENSE_FORM } from '@/test/test-ids';

export interface InlineColleagueCreatorProps {
  onCreated: (colleague: { id: number; name: string }) => void;
}

export const InlineColleagueCreator: React.FC<InlineColleagueCreatorProps> = ({ onCreated }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isNameValid = colleagueSchema.shape.name.safeParse(trimmedName).success;

  const handleAdd = async (): Promise<void> => {
    if (!isNameValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createColleague({ data: { name: trimmedName } });
      toast.success(m.colleague_toast_added({ name: created.name }));
      onCreated(created);
      setName('');
    } catch {
      setError(m.expense_form_inlineColleagueFailed());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-3 p-4 border rounded-lg bg-muted/30">
      <p className="text-sm text-muted-foreground">{m.expense_form_noColleaguesPrompt()}</p>
      <div className="flex items-end gap-2">
        <div className="flex-1 grid gap-2">
          <Label htmlFor={EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT}>
            {m.expense_form_inlineColleagueLabel()}
          </Label>
          <Input
            id={EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT}
            type="text"
            placeholder={m.expense_form_inlineColleaguePlaceholder()}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            data-testid={EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAdd();
              }
            }}
          />
        </div>
        <Button
          type="button"
          disabled={!isNameValid || isSubmitting}
          onClick={() => void handleAdd()}
          data-testid={EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN}
        >
          {isSubmitting
            ? m.expense_form_inlineColleagueAdding()
            : m.expense_form_inlineColleagueAdd()}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive-text">{error}</p>}
    </div>
  );
};
