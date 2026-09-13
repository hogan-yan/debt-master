/**
 * Common types used across the debt-master application
 */

export type SplitType = 'EQUAL' | 'ITEMIZED';

export type PaymentType = 'PAYME' | 'FPS' | 'CASH' | 'OTHER';

export type ActivityType = 'expense' | 'payment';

export interface BaseEntity {
  id: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface FormSubmissionState {
  isSubmitting: boolean;
  error?: string;
}
