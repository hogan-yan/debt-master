import { Link } from '@tanstack/react-router';
import { Check, Receipt } from 'lucide-react';
import { transactionAmountId } from '@/test/test-ids';
import { formatCurrency } from '@/utils/formatters';
import type { Transaction } from './use-transaction-filter';

export interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';
  const href = isExpense ? `/expenses/${transaction.id}` : `/payments/${transaction.id}`;

  return (
    <Link
      to={href}
      data-transaction
      className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isExpense ? 'bg-destructive/10' : 'bg-success/10'
          }`}
        >
          {isExpense ? (
            <Receipt className="h-4 w-4 text-destructive-text" />
          ) : (
            <Check className="h-4 w-4 text-success" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">{transaction.description}</p>
          <p className="text-sm text-muted-foreground">{transaction.details}</p>
          {transaction.notes && (
            <p className="text-sm text-muted-foreground mt-1 italic">
              &ldquo;{transaction.notes}&rdquo;
            </p>
          )}
        </div>
      </div>
      <div
        className={`font-semibold ${isExpense ? 'text-destructive-text' : 'text-success'}`}
        data-testid={transactionAmountId(transaction.id)}
      >
        {isExpense ? '-' : '+'}
        {formatCurrency(transaction.amount)}
      </div>
    </Link>
  );
}
