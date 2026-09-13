/**
 * Restaurant-related types for the debt-master application
 */

import { PaginationInfo } from '@/components/ui/paginated-data-table';
import type { Cuisine } from '@/lib/schemas';
import { BaseEntity } from './common';

export interface Restaurant extends BaseEntity {
  name: string;
  address?: string | null;
  cuisine?: string | null;
  notes?: string | null;
  // Extended fields from server
  totalExpenses?: number;
  totalAmount?: number;
  expenses?: RestaurantExpense[];
}

export interface RestaurantExpense {
  id: number;
  amount: number;
  date: Date;
  participants?: RestaurantExpenseParticipant[];
}

export interface RestaurantExpenseParticipant {
  id: number;
  amount: number;
  colleague: {
    id: number;
    name: string;
    currentBalance: number;
    createdAt: Date;
  };
  expenseId: number;
  colleagueId: number;
  isPaid: boolean;
}

export interface RestaurantForm {
  name: string;
  address: string;
  cuisine?: Cuisine;
  notes?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'name' | 'address' | 'totalExpenses' | 'totalAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedRestaurants {
  data: Restaurant[];
  pagination: PaginationInfo;
}
