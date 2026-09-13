/**
 * Colleague-related types for the debt-master application
 */

import { PaginationInfo } from '@/components/ui/paginated-data-table';
import { BaseEntity } from './common';

export interface Colleague extends BaseEntity {
  name: string;
  avatar?: string;
  lastActivity?: string;
  // Extended fields from server
  expenseParticipants?: ColleagueExpenseParticipant[];
  payments?: ColleaguePayment[];
}

export interface ColleagueExpenseParticipant {
  id: number;
  amount: number;
  expense: {
    id: number;
    amount: number;
    date: Date;
    restaurantId: number;
    restaurant?: {
      id: number;
      name: string;
      address?: string | null;
    } | null;
  } | null;
  expenseId: number;
  colleagueId: number;
}

export interface ColleaguePayment {
  id: number;
  amount: number;
  date: Date;
  paymentType: string;
  notes?: string | null;
}

export interface ColleagueForm {
  name: string;
}

export interface ColleagueWithBalance extends Colleague {
  currentBalance: number; // Calculated dynamically
  status?: 'owes' | 'credit' | 'balanced';
}

export interface ColleaguePaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'name' | 'currentBalance';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedColleagues {
  data: ColleagueWithBalance[];
  pagination: PaginationInfo;
}

export interface InactiveColleagueWithBalance extends Colleague {
  deletedAt: Date | null;
  deletedBy: number | null;
  currentBalance: number;
}

export interface PaginatedInactiveColleagues {
  data: InactiveColleagueWithBalance[];
  pagination: PaginationInfo;
}
