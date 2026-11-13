/**
 * Payment-related types for the debt-master application
 */

import { PaginationInfo } from '@/components/ui/paginated-data-table';
import { BaseEntity, PaymentType } from './common';

export interface Payment extends BaseEntity {
  colleagueId: number;
  amount: number;
  date: string | Date;
  paymentType: PaymentType;
  restaurantId?: number | null;
  expenseId?: number | null;
  receiptBucket?: string | null;
  receiptObjectKey?: string | null;
  paymentProofBucket?: string | null;
  paymentProofObjectKey?: string | null;
  isApproved: boolean;
  submittedAt?: string | Date | null;
  createdAt: string | Date;
  createdBy?: string | null;
  colleague?: {
    id: number;
    name: string;
  };
  restaurant?: {
    id: number;
    name: string;
    address?: string | null;
  } | null;
  expense?: {
    id: number;
    date: string | Date;
    amount: number;
    restaurant?: {
      id: number;
      name: string;
      address?: string | null;
    };
  } | null;
  applications?: {
    id: number;
    amount: number;
    appliedAt: string | Date;
    expense?: {
      id: number;
      date: string | Date;
      restaurant?: {
        id: number;
        name: string;
      };
    } | null;
  }[];
}

export interface PaymentForm {
  colleagueId: string;
  amount: string;
  date: string;
  paymentType: PaymentType;
  paymentProofFile?: File | undefined;
  expenseId?: number | undefined;
  restaurantId?: number | undefined;
  keepExistingProof?: boolean | undefined;
  removeExistingProof?: boolean | undefined;
  selectedExpenseIds?: number[] | undefined;
  expenseAmounts?: Record<string, string> | undefined;
}

export interface PaymentPaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'date' | 'amount' | 'paymentType' | 'colleagueName';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPayments {
  data: Payment[];
  pagination: PaginationInfo;
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  averageAmount: number;
  uniquePayers: number;
}
