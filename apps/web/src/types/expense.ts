/**
 * Expense-related types for the debt-master application
 */

import { PaginationInfo } from '@/components/ui/paginated-data-table';
import { BaseEntity, SplitType } from './common';

export interface Expense extends BaseEntity {
  date: string | Date;
  restaurant?:
    | {
        id: number;
        name: string;
        address?: string | null;
      }
    | null
    | undefined;
  restaurantId?: number;
  amount: number;
  participants?: ExpenseParticipantWithColleague[];
  participantIds?: number[];
  splitType: SplitType | string;
  notes?: string | null;
  items?: ExpenseItem[];
  receiptBucket?: string | null;
  receiptObjectKey?: string | null;
}

export interface ExpenseParticipantWithColleague {
  id: number;
  amount: number;
  colleague?:
    | {
        id: number;
        name: string;
        createdAt?: Date;
      }
    | null
    | undefined;
  expenseId: number;
  colleagueId: number;
  isPaid: boolean;
  isPending: boolean;
  hasPartialPayment: boolean;
  submittedAt: Date | string | null;
  paymentProofBucket?: string | null;
  paymentProofObjectKey?: string | null;
  // Payment application fields
  totalPaid?: number;
  remainingOwed?: number;
  paymentApplications?: {
    id: number;
    amount: number;
    appliedAt: string | Date;
    payment?:
      | {
          id: number;
          amount: number;
          date: string | Date;
          paymentType: string;
          isApproved: boolean;
        }
      | null
      | undefined;
  }[];
}

export interface ExpenseItem {
  id: number;
  name: string;
  price: number;
  colleague?:
    | {
        id: number;
        name: string;
        createdAt?: Date;
      }
    | null
    | undefined;
  expenseId: number;
  colleagueId: number;
}

export interface ExpenseForm {
  date: string;
  restaurantId: string;
  amount: string;
  splitType: SplitType;
  participantIds: number[];
  notes?: string;
}

export interface ExpenseParticipant {
  colleagueId: number;
  colleagueName: string;
  amount: number;
  paid: boolean;
}

export interface ExpensePaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'date' | 'amount' | 'splitType' | 'restaurant' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedExpenses {
  data: Expense[];
  pagination: PaginationInfo;
}

export interface UnpaidExpense {
  id: number;
  date: string | Date;
  restaurantName: string;
  restaurantId: number;
  totalAmount: number;
  colleagueAmount: number;
  participantId: number;
  notes?: string | null;
  participantCount: number;
  splitType: string;
}
