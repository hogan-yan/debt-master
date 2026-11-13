import { Prisma } from '@prisma/client';

import { serializeDecimal } from '@/server/utils/decimal';
/**
 * Define types for payment with relations
 */
export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    colleague: true;
    restaurant: true;
    applications: {
      include: {
        expense: {
          include: {
            restaurant: true;
          };
        };
      };
    };
  };
}>;

/**
 * Define a more flexible type for basic payment operations
 */
export type PaymentWithBasicApplications = Prisma.PaymentGetPayload<{
  include: {
    colleague: true;
    restaurant: true;
    applications: true;
  };
}>;

export type PaymentBasic = Prisma.PaymentGetPayload<object>;

export interface PaymentWithApplicationsRaw {
  id: number;
  amount: Prisma.Decimal | number;
  date: Date;
  paymentType: string;
  isApproved: boolean;
  colleagueId: number;
  restaurantId: number | null;
  paymentProofBucket: string | null;
  paymentProofObjectKey: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  expenseId: number | null;
  colleague?: { id: number; name: string; createdAt: Date };
  restaurant?: { id: number; name: string; createdAt: Date; address: string | null } | null;
  applications: Array<{
    id: number;
    paymentId: number;
    expenseId: number;
    participantId: number;
    amount: Prisma.Decimal | number;
    appliedAt: Date;
    expense?: {
      id: number;
      date: Date;
      amount: Prisma.Decimal;
      restaurant: { id: number; name: string } | null;
    } | null;
  }>;
}

/**
 * Helper function to serialize Decimal to number - handle both full and basic application types
 */
export const serializePayment = (
  payment: PaymentWithRelations | PaymentWithBasicApplications | PaymentWithApplicationsRaw
) => ({
  ...payment,
  amount: serializeDecimal(payment.amount),
  paymentType: payment.paymentType as 'PAYME' | 'FPS' | 'CASH' | 'OTHER',
  isApproved: payment.isApproved,
  submittedAt: payment.submittedAt,
  colleague: payment.colleague
    ? {
        ...payment.colleague,
      }
    : undefined,
  restaurant: payment.restaurant || null,
  applications: payment.applications
    ? payment.applications.map((app) => ({
        ...app,
        amount: serializeDecimal(app.amount),
        expense:
          app && 'expense' in app && app.expense
            ? {
                id: app.expense.id,
                date: app.expense.date,
                amount: serializeDecimal(app.expense.amount),
                ...(app.expense.restaurant ? { restaurant: app.expense.restaurant } : {}),
              }
            : null,
      }))
    : [],
});
