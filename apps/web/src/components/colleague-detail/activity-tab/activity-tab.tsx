import { Inbox, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { m } from '@/paraglide/messages';
import { COLLEAGUE_DETAIL } from '@/test/test-ids';
import { TransactionGroup } from './transaction-group';
import type { Transaction } from './use-transaction-filter';
import { useTransactionFilter } from './use-transaction-filter';

interface ActivityTabProps {
  transactions: Transaction[];
  onRecordPayment?: () => void;
}

export function ActivityTab({ transactions, onRecordPayment }: ActivityTabProps) {
  const {
    filteredTransactions,
    groupedTransactions,
    filterType,
    searchQuery,
    currentPage,
    totalPages,
    setFilterType,
    setSearchQuery,
    setCurrentPage,
  } = useTransactionFilter(transactions);

  const { expenseCount, paymentCount, totalCount } = useMemo(
    () => ({
      expenseCount: transactions.filter((t) => t.type === 'expense').length,
      paymentCount: transactions.filter((t) => t.type === 'payment').length,
      totalCount: transactions.length,
    }),
    [transactions]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
          data-testid={COLLEAGUE_DETAIL.ALL_FILTER_BTN}
        >
          {m.colleague_detail_filterAll()} ({totalCount})
        </Button>
        <Button
          variant={filterType === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('expense')}
          data-testid={COLLEAGUE_DETAIL.EXPENSE_FILTER_BTN}
        >
          {m.colleague_detail_filterExpenses()} ({expenseCount})
        </Button>
        <Button
          variant={filterType === 'payment' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('payment')}
          data-testid={COLLEAGUE_DETAIL.PAYMENT_FILTER_BTN}
        >
          {m.colleague_detail_filterPayments()} ({paymentCount})
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={m.colleague_detail_searchTransactions()}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid={COLLEAGUE_DETAIL.ACTIVITY_SEARCH_INPUT}
        />
      </div>

      {filteredTransactions.length > 0 ? (
        <div className="space-y-6">
          {groupedTransactions.map((group) => (
            <TransactionGroup
              key={group.label}
              label={group.label}
              transactions={group.transactions}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {m.colleague_detail_noTransactionsFound()}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {transactions.length === 0
              ? m.colleague_detail_noTransactionsYetDesc()
              : m.colleague_detail_noTransactionsMatch()}
          </p>
          {transactions.length === 0 && onRecordPayment && (
            <Button
              onClick={onRecordPayment}
              size="sm"
              data-testid={COLLEAGUE_DETAIL.RECORD_PAYMENT_EMPTY_BTN}
            >
              {m.colleague_detail_recordPayment()}
            </Button>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            {m.colleague_detail_previous()}
          </Button>
          <span className="text-sm text-muted-foreground">
            {m.colleague_detail_page({ current: currentPage, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            {m.colleague_detail_next()}
          </Button>
        </div>
      )}
    </div>
  );
}
