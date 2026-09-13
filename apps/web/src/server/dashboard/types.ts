/**
 * Dashboard data types and interfaces
 */

export interface DashboardStats {
  totalColleagues: number;
  totalOutstanding: number;
  totalCredit: number;
  totalPayments: number;
  netBalance: number;
  activeColleagues: number;
}

export interface RecentActivity {
  id: number;
  type: 'expense' | 'payment';
  description: string;
  amount: number;
  date: string;
  colleague?: string;
  restaurant?: string;
}

export interface ColleagueWithBalance {
  id: number;
  name: string;
  currentBalance: number;
  totalOwed: number;
  totalPaid: number;
  lastActivity: string;
}

export interface PendingPayment {
  id: number;
  amount: number;
  date: string;
  colleague: string;
  restaurant?: string;
  submittedAt?: string;
  paymentType: string;
}
