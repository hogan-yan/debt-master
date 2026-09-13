export interface ColleagueDebtTransaction {
  type: 'expense' | 'payment';
  amount: number;
  date: Date;
}

interface DebtAgeResult {
  debtAgeDays: number | null;
  longestDebtPeriod: number | null;
  timesInDebt: number;
  averageDebtDuration: number | null;
}

interface DebtPeriod {
  startDate: Date;
  endDate: Date | null; // null = ongoing
}

interface CompletedDebtPeriod extends DebtPeriod {
  endDate: Date;
}

function isCompletedDebtPeriod(period: DebtPeriod): period is CompletedDebtPeriod {
  return period.endDate !== null;
}

export function calculateDebtAge(transactions: ColleagueDebtTransaction[]): DebtAgeResult {
  if (transactions.length === 0) {
    return {
      debtAgeDays: null,
      longestDebtPeriod: null,
      timesInDebt: 0,
      averageDebtDuration: null,
    };
  }

  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  let currentPeriodStart: Date | null = null;
  const debtPeriods: DebtPeriod[] = [];
  const EPSILON = 0.005;

  for (const t of sorted) {
    if (t.type === 'expense') {
      runningBalance -= t.amount;
    } else {
      runningBalance += t.amount;
    }

    if (runningBalance < -EPSILON) {
      if (!currentPeriodStart) {
        currentPeriodStart = t.date;
      }
    } else {
      if (currentPeriodStart) {
        debtPeriods.push({ startDate: currentPeriodStart, endDate: t.date });
        currentPeriodStart = null;
      }
    }
  }

  // If still in debt at end, record as ongoing period
  if (currentPeriodStart) {
    debtPeriods.push({ startDate: currentPeriodStart, endDate: null });
  }

  // debtAgeDays: days since the start of the current (ongoing) debt period
  let debtAgeDays: number | null = null;
  const ongoingPeriod = debtPeriods.find((p) => p.endDate === null);
  if (ongoingPeriod) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const startDate = new Date(ongoingPeriod.startDate);
    startDate.setHours(12, 0, 0, 0);
    debtAgeDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // longestDebtPeriod: longest duration among all completed debt periods (in days)
  let longestDebtPeriod: number | null = null;
  const completedPeriods = debtPeriods.filter(isCompletedDebtPeriod);
  for (const period of completedPeriods) {
    const start = new Date(period.startDate);
    start.setHours(12, 0, 0, 0);
    const end = new Date(period.endDate);
    end.setHours(12, 0, 0, 0);
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (longestDebtPeriod === null || duration > longestDebtPeriod) {
      longestDebtPeriod = duration;
    }
  }

  // timesInDebt: total number of debt periods (including ongoing)
  const timesInDebt = debtPeriods.length;

  // averageDebtDuration: average of completed periods only
  let averageDebtDuration: number | null = null;
  if (completedPeriods.length > 0) {
    let totalDuration = 0;
    for (const period of completedPeriods) {
      const start = new Date(period.startDate);
      start.setHours(12, 0, 0, 0);
      const end = new Date(period.endDate);
      end.setHours(12, 0, 0, 0);
      totalDuration += Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    averageDebtDuration = totalDuration / completedPeriods.length;
  }

  return { debtAgeDays, longestDebtPeriod, timesInDebt, averageDebtDuration };
}
