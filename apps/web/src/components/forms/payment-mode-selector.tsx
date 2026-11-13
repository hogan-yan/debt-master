import { CreditCard, Receipt } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { PAYMENT } from '@/test/test-ids';
import { type PaymentMode } from './use-payment-form';

interface PaymentModeSelectorProps {
  selected: PaymentMode;
  onChange: (mode: PaymentMode) => void;
}

export function PaymentModeSelector({ selected, onChange }: PaymentModeSelectorProps) {
  return (
    <div role="radiogroup" aria-label={m.payment_form_paymentMode()} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'PREPAYMENT'}
          onClick={() => onChange('PREPAYMENT')}
          data-testid={PAYMENT.PREPAYMENT_MODE_BTN}
          className={`p-3 rounded-lg border-2 text-left transition ${
            selected === 'PREPAYMENT'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-border/80'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <CreditCard className="h-4 w-4" />
            <span className="font-medium">{m.payment_form_prepayment()}</span>
          </div>
          <p className="text-xs text-muted-foreground">{m.payment_form_creditForFuture()}</p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === 'EXPENSE_PAYMENT'}
          onClick={() => onChange('EXPENSE_PAYMENT')}
          data-testid={PAYMENT.EXPENSE_PAYMENT_MODE_BTN}
          className={`p-3 rounded-lg border-2 text-left transition ${
            selected === 'EXPENSE_PAYMENT'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-border/80'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <Receipt className="h-4 w-4" />
            <span className="font-medium">{m.payment_form_expensePaymentMode()}</span>
          </div>
          <p className="text-xs text-muted-foreground">{m.payment_form_payForSpecific()}</p>
        </button>
      </div>
    </div>
  );
}
