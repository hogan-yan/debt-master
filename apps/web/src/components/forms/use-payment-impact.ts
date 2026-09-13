import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';

export interface ParticipantWithPayments {
  id: number;
  amount: number;
  colleague?: { id: number; name: string; createdAt?: Date } | null | undefined;
  paymentApplications?: Array<{
    amount: number;
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
  }>;
}

export interface PaymentImpact {
  name: string;
  currentAmount: number;
  paidAmount: number;
  currentOwed: number;
}

interface UsePaymentImpactParams {
  isEditing: boolean;
  participants: ParticipantWithPayments[] | undefined;
}

interface UsePaymentImpactReturn {
  hasExistingPayments: boolean;
  showPaymentWarning: boolean;
  confirmEdit: boolean;
  paymentImpacts: PaymentImpact[] | null;
  setConfirmEdit: (value: boolean) => void;
}

export function usePaymentImpact({
  isEditing,
  participants,
}: UsePaymentImpactParams): UsePaymentImpactReturn {
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  const hasExistingPayments =
    isEditing &&
    (participants?.some((p) => p.paymentApplications?.some((app) => app.payment?.isApproved)) ??
      false);

  useEffect(() => {
    if (hasExistingPayments) {
      setShowPaymentWarning(true);
    }
  }, [hasExistingPayments]);

  const paymentImpacts: PaymentImpact[] | null = (() => {
    if (!hasExistingPayments || !participants) return null;

    const impacts = participants.map((participant) => {
      const currentAmount = participant.amount;
      const paidAmount =
        participant.paymentApplications
          ?.filter((app) => app.payment?.isApproved)
          ?.reduce((sum, app) => sum + Number.parseFloat(app.amount.toString()), 0) ?? 0;

      return {
        name: participant.colleague?.name ?? m.common_unknown(),
        currentAmount,
        paidAmount,
        currentOwed: Math.max(0, currentAmount - paidAmount),
      };
    });

    return impacts.filter((impact) => impact.paidAmount > 0);
  })();

  return {
    hasExistingPayments,
    showPaymentWarning,
    confirmEdit,
    paymentImpacts,
    setConfirmEdit,
  };
}
