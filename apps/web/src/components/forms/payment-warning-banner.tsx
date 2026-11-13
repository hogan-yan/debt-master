import { AlertTriangle } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface PaymentImpact {
  name: string;
  currentAmount: number;
  paidAmount: number;
  currentOwed: number;
}

interface PaymentWarningBannerProps {
  paymentImpacts: PaymentImpact[] | null;
  confirmEdit: boolean;
  onConfirmChange: (checked: boolean) => void;
}

export function PaymentWarningBanner({
  paymentImpacts,
  confirmEdit,
  onConfirmChange,
}: PaymentWarningBannerProps) {
  return (
    <div className="border border-warning/20 bg-warning/10 rounded-lg p-4 space-y-3">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <h3 className="font-medium text-warning">{m.payment_warning_title()}</h3>
          <p className="text-sm text-warning">{m.payment_warning_description()}</p>

          {paymentImpacts && paymentImpacts.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-warning mb-2">
                {m.payment_warning_currentStatus()}
              </h4>
              <div className="space-y-1">
                {paymentImpacts.map((impact) => (
                  <div
                    key={impact.name}
                    className="text-xs text-warning bg-warning/15 rounded px-2 py-1"
                  >
                    <strong>{impact.name}</strong>:{' '}
                    {m.payment_warning_owes({ amount: `$${impact.currentAmount.toFixed(2)}` })},{' '}
                    {m.payment_warning_paid({ amount: `$${impact.paidAmount.toFixed(2)}` })},{' '}
                    {m.payment_warning_remaining({ amount: `$${impact.currentOwed.toFixed(2)}` })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 mt-3">
            <Checkbox
              id="confirmEdit"
              checked={confirmEdit}
              onCheckedChange={(checked) => onConfirmChange(!!checked)}
            />
            <Label htmlFor="confirmEdit" className="text-sm text-warning">
              {m.payment_warning_confirmUnderstanding()}
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
