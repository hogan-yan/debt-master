import { Prisma } from '@prisma/client';

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: {
    restaurant: true;
    participants: {
      include: {
        colleague: true;
        paymentApplications: {
          include: {
            payment: true;
          };
        };
      };
    };
    items: {
      include: {
        colleague: true;
      };
    };
  };
}>;

export type ExpenseParticipant = ExpenseWithRelations['participants'][0];
export type ExpenseItem = ExpenseWithRelations['items'][0];
