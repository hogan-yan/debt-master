import { FileText, Sparkles, Wallet } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { type PaymentMode } from './use-payment-form';

interface PaymentInfoBoxProps {
  mode: PaymentMode;
}

export function PaymentInfoBox({ mode }: PaymentInfoBoxProps) {
  const isPrepayment = mode === 'PREPAYMENT';

  return (
    <div
      className={`border rounded-lg p-4 ${isPrepayment ? 'bg-info/10 border-info/20' : 'bg-success/10 border-success/20'}`}
    >
      <div className="flex items-start">
        <div className={`mr-3 text-lg ${isPrepayment ? 'text-info' : 'text-success'}`}>
          {isPrepayment ? <Wallet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <div className={`text-sm ${isPrepayment ? 'text-info' : 'text-success dark:text-success'}`}>
          <p className="font-medium mb-2">
            {isPrepayment
              ? m.payment_form_aboutPrepayments()
              : m.payment_form_aboutExpensePayments()}
          </p>
          <p className="mb-2">
            {isPrepayment ? m.payment_form_prepaymentDesc() : m.payment_form_expensePaymentDesc()}
          </p>
          {isPrepayment && (
            <p className="text-xs text-info flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {m.payment_form_prepaymentAutoApply()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
