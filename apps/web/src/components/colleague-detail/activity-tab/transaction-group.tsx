import { TransactionItem } from './transaction-item';
import type { Transaction } from './use-transaction-filter';

interface TransactionGroupProps {
  label: string;
  transactions: Transaction[];
}

export function TransactionGroup({ label, transactions }: TransactionGroupProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="space-y-2">
        {transactions.map((t) => (
          <TransactionItem key={`${t.type}-${t.id}`} transaction={t} />
        ))}
      </div>
    </div>
  );
}
