import { useEffect, useState } from 'react';
import { SplitType } from '@/types';
import { type ExpenseItem } from './expense-form';

export interface PendingClaim {
  id: number;
  amount: number;
  colleagueId: number;
  submittedAt: Date;
  colleagueName: string;
  hasPaymentProof: boolean;
}

type PendingClaimsChoice = 'keep' | 'cancel' | 'adjust';

interface PendingSubmissionData {
  date: string;
  restaurantId: number;
  amount: number;
  splitType: SplitType;
  participantIds: number[];
  items?: ExpenseItem[] | undefined;
  notes?: string | undefined;
  receiptFile?: File | undefined;
  removeExistingReceipt?: boolean | undefined;
  pendingClaimsChoice?: PendingClaimsChoice | undefined;
}

interface UsePendingClaimsParams {
  isEditing: boolean;
  expenseId: number | undefined;
}

interface UsePendingClaimsReturn {
  pendingClaims: PendingClaim[];
  pendingSubmissionData: PendingSubmissionData | null;
  showWarningModal: boolean;
  pendingClaimsChoice: PendingClaimsChoice;
  checkPendingClaims: (
    submissionData: PendingSubmissionData,
    currentAmount: number,
    initialAmount: number | undefined
  ) => boolean;
  handleWarningConfirm: (
    choice: PendingClaimsChoice,
    onSubmit: (data: PendingSubmissionData) => Promise<void>,
    handleSubmit: <T>(fn: () => Promise<T>, toastMessage: string) => Promise<T | null>,
    getToastMessage: (data: PendingSubmissionData) => string
  ) => Promise<void>;
  setShowWarningModal: (value: boolean) => void;
  setPendingClaimsChoice: (value: PendingClaimsChoice) => void;
}

export function usePendingClaims({
  isEditing,
  expenseId,
}: UsePendingClaimsParams): UsePendingClaimsReturn {
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingSubmissionData, setPendingSubmissionData] = useState<PendingSubmissionData | null>(
    null
  );
  const [pendingClaimsChoice, setPendingClaimsChoice] = useState<PendingClaimsChoice>('keep');

  useEffect(() => {
    const fetchPendingClaims = async (): Promise<void> => {
      if (isEditing && expenseId !== undefined) {
        try {
          const { getPendingClaimsForExpense } = await import('@/server/expenses');
          const claims = await getPendingClaimsForExpense({ data: { expenseId } });
          setPendingClaims(claims);
        } catch (_error) {}
      }
    };

    fetchPendingClaims();
  }, [isEditing, expenseId]);

  const checkPendingClaims = (
    submissionData: PendingSubmissionData,
    currentAmount: number,
    initialAmount: number | undefined
  ): boolean => {
    if (isEditing && pendingClaims.length > 0 && initialAmount !== currentAmount) {
      setPendingSubmissionData(submissionData);
      setShowWarningModal(true);
      return true;
    }
    return false;
  };

  const handleWarningConfirm = async (
    choice: PendingClaimsChoice,
    onSubmit: (data: PendingSubmissionData) => Promise<void>,
    handleSubmit: <T>(fn: () => Promise<T>, toastMessage: string) => Promise<T | null>,
    getToastMessage: (data: PendingSubmissionData) => string
  ): Promise<void> => {
    setPendingClaimsChoice(choice);
    setShowWarningModal(false);

    if (pendingSubmissionData) {
      const submissionData = {
        ...pendingSubmissionData,
        pendingClaimsChoice: choice,
      };
      const toastMessage = getToastMessage(pendingSubmissionData);

      await handleSubmit(async () => {
        await onSubmit(submissionData);
        return { success: true };
      }, toastMessage);
    }
  };

  return {
    pendingClaims,
    pendingSubmissionData,
    showWarningModal,
    pendingClaimsChoice,
    checkPendingClaims,
    handleWarningConfirm,
    setShowWarningModal,
    setPendingClaimsChoice,
  };
}
