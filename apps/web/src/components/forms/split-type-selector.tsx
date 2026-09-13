import { m } from '@/paraglide/messages';
import { EXPENSE_FORM } from '@/test/test-ids';
import { type SplitType } from '@/types';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface SplitTypeSelectorProps {
  value: SplitType;
  onChange: (value: SplitType) => void;
}

export function SplitTypeSelector({ value, onChange }: SplitTypeSelectorProps) {
  return (
    <div className="grid gap-2">
      <Label>{m.split_type_label()}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as SplitType)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem
            value="ITEMIZED"
            id="itemized"
            data-testid={EXPENSE_FORM.ITEMIZED_RADIO}
          />
          <Label htmlFor="itemized">{m.split_type_itemized()}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="EQUAL" id="equal" data-testid={EXPENSE_FORM.EQUAL_RADIO} />
          <Label htmlFor="equal">{m.split_type_equal()}</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
