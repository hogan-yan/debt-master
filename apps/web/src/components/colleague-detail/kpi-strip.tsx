import { DollarSign, History, Timer, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { StatisticCard } from '@/components/ui/statistic-card';
import { m } from '@/paraglide/messages';
import { COLLEAGUE_DETAIL } from '@/test/test-ids';
import { formatCurrency, getBalanceColor, getDateBadgeInfo } from '@/utils/formatters';

export interface KpiStripProps {
  currentBalance: number;
  totalOwed: number;
  totalPaid: number;
  debtAgeDays: number | null;
  lastActivityDate: Date | null;
}

function getBalanceIcon(balance: number) {
  if (balance < 0) return <TrendingDown className="h-4 w-4 text-destructive-text" />;
  if (balance > 0) return <TrendingUp className="h-4 w-4 text-success" />;
  return <DollarSign className="h-4 w-4 text-muted-foreground" />;
}

function getBalanceDescription(balance: number): string {
  if (balance < 0) return m.colleague_detail_amountOwed();
  if (balance > 0) return m.colleague_detail_creditBalance();
  return m.colleague_detail_balanced();
}

function formatLastActivity(date: Date | null): string {
  if (!date) return m.colleague_detail_noActivity();
  const badge = getDateBadgeInfo(date.toISOString());
  return badge.relativeText;
}

function formatPaymentRatio(totalOwed: number, totalPaid: number): string {
  if (totalOwed <= 0) return m.colleague_detail_na();
  const ratio = Math.min(Math.round((totalPaid / totalOwed) * 100), 100);
  return `${ratio}%`;
}

function getPaymentRatioDescription(totalOwed: number, totalPaid: number): string {
  if (totalOwed <= 0) return m.colleague_detail_noExpensesYet();
  if (totalPaid >= totalOwed) return m.colleague_detail_fullySettled();
  return `${formatCurrency(totalPaid)} of ${formatCurrency(totalOwed)}`;
}

export function KpiStrip({
  currentBalance,
  totalOwed,
  totalPaid,
  debtAgeDays,
  lastActivityDate,
}: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatisticCard
        title={m.colleague_detail_netBalance()}
        value={formatCurrency(currentBalance)}
        description={getBalanceDescription(currentBalance)}
        valueClassName={getBalanceColor(currentBalance)}
        icon={getBalanceIcon(currentBalance)}
        data-testid={COLLEAGUE_DETAIL.NET_BALANCE_KPI}
      />
      <StatisticCard
        title={m.colleague_detail_debtAge()}
        data-testid={COLLEAGUE_DETAIL.DEBT_AGE_KPI}
        value={
          debtAgeDays !== null
            ? m.colleague_detail_days({ count: debtAgeDays })
            : m.colleague_detail_na()
        }
        description={
          debtAgeDays !== null
            ? m.colleague_detail_sinceFirstNegative()
            : m.colleague_detail_notInDebt()
        }
        icon={<Timer className="h-4 w-4" aria-label={m.colleague_detail_debtAgeAria()} />}
      />
      <StatisticCard
        title={m.colleague_detail_lastActivity()}
        data-testid={COLLEAGUE_DETAIL.LAST_ACTIVITY_KPI}
        value={formatLastActivity(lastActivityDate)}
        description={
          lastActivityDate
            ? m.colleague_detail_mostRecentTransaction()
            : m.colleague_detail_noTransactionsYet()
        }
        icon={<History className="h-4 w-4" aria-label={m.colleague_detail_lastActivityAria()} />}
      />
      <StatisticCard
        title={m.colleague_detail_paymentRatio()}
        data-testid={COLLEAGUE_DETAIL.PAYMENT_RATIO_KPI}
        value={formatPaymentRatio(totalOwed, totalPaid)}
        description={getPaymentRatioDescription(totalOwed, totalPaid)}
        valueClassName={totalPaid >= totalOwed && totalOwed > 0 ? 'text-success' : ''}
        icon={<Wallet className="h-4 w-4" aria-label={m.colleague_detail_paymentRatioAria()} />}
      />
    </div>
  );
}
