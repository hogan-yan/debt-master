import { useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { m } from '@/paraglide/messages';
import {
  approvePaymentClaim,
  claimPayment,
  getPendingPaymentClaims,
  undoClaim,
} from '@/server/expenses';
import { getPaymentProofUrlByPaymentId } from '@/server/payments';
import { ErrorCode, isAppError } from '@/utils/errors';

/**
 * Detect stale-data errors (participant removed or claim changed).
 * Checks structured error code first, falls back to message matching.
 */
function isStaleDataError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === ErrorCode.NOT_FOUND_PARTICIPANT ||
      error.code === ErrorCode.BUSINESS_NO_PENDING_CLAIM
    );
  }
  return (
    error instanceof Error &&
    (error.message?.includes('Participant not found') || error.message?.includes('refresh'))
  );
}

/**
 * Custom hook for managing payment operations
 * Centralizes payment claim approval, undo operations, and proof handling
 */
export const usePaymentOperations = () => {
  const router = useRouter();
  const [isProcessingClaim, setIsProcessingClaim] = useState<Record<number, boolean>>({});
  const [isToastActionActive, setIsToastActionActive] = useState(false);
  const [pendingClaimsByColleague, setPendingClaimsByColleague] = useState<
    Record<
      number,
      { participantId: number; submittedAt: Date; hasPaymentProof: boolean; paymentId: number }
    >
  >({});

  /**
   * Fetch pending payment claims for a specific restaurant
   */
  const fetchPendingClaims = useCallback(async (restaurantId?: number) => {
    try {
      const pendingClaims = await getPendingPaymentClaims();
      const claimsByColleague: Record<
        number,
        { participantId: number; submittedAt: Date; hasPaymentProof: boolean; paymentId: number }
      > = {};

      pendingClaims.forEach((claim) => {
        if (
          claim.colleague &&
          (!restaurantId || claim.restaurantId === restaurantId) &&
          claim.participantId
        ) {
          claimsByColleague[claim.colleague.id] = {
            participantId: claim.participantId,
            submittedAt: claim.submittedAt || new Date(),
            hasPaymentProof: !!(claim.paymentProofBucket && claim.paymentProofObjectKey),
            paymentId: claim.id,
          };
        }
      });

      setPendingClaimsByColleague(claimsByColleague);
    } catch (_error) {}
  }, []);

  /**
   * Refresh expense data by invalidating router cache and refetching pending claims
   */
  const refreshExpenseData = useCallback(
    async (restaurantId?: number) => {
      try {
        await router.invalidate();
        // Also refetch pending claims to ensure UI state is up to date
        if (restaurantId) {
          await fetchPendingClaims(restaurantId);
        }
      } catch (_error) {}
    },
    [router, fetchPendingClaims]
  );

  /**
   * Handle undoing a payment claim
   */
  const handleUndoPaymentClaim = useCallback(
    async (participantId: number) => {
      setIsProcessingClaim((prev) => ({ ...prev, [participantId]: true }));

      try {
        await undoClaim({ data: { participantId, type: 'PENDING' } });

        // Get restaurant ID from the current claims or refetch all claims
        await Promise.all([refreshExpenseData(), fetchPendingClaims()]);

        toast.success(m.payment_modal_claimCancelled());
      } catch (error) {
        // If the error is about participant not found, it's likely due to expense edit
        if (isStaleDataError(error)) {
          toast.error(m.payment_operation_expenseModified(), {
            duration: 3000,
          });

          // Force a full page refresh to get the latest data
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error(error instanceof Error ? error.message : m.payment_modal_cancelFailed());
        }
      } finally {
        setIsProcessingClaim((prev) => ({ ...prev, [participantId]: false }));
      }
    },
    [refreshExpenseData, fetchPendingClaims]
  );

  /**
   * Handle approving a payment claim - Admin only
   */
  const handleApprovePaymentClaim = useCallback(
    async (participantId: number) => {
      setIsProcessingClaim((prev) => ({ ...prev, [participantId]: true }));

      try {
        await approvePaymentClaim({ data: { participantId } });

        // Refresh all data in parallel
        await Promise.all([router.invalidate(), refreshExpenseData(), fetchPendingClaims()]);

        toast.success(m.pendingClaim_confirmSuccess(), {
          description: m.pendingClaim_confirmSuccessDesc(),
          action: {
            label: m.payment_modal_undo(),
            onClick: async () => {
              setIsToastActionActive(true);
              try {
                await undoClaim({
                  data: { participantId, type: 'APPROVED' },
                });
                toast.success(m.pendingClaim_undoSuccess());
                await Promise.all([refreshExpenseData(), fetchPendingClaims()]);
              } catch (_error) {
                toast.error(m.pendingClaim_undoFailed());
              } finally {
                setIsToastActionActive(false);
              }
            },
          },
          duration: 10000,
        });
      } catch (error) {
        // If the error is about participant not found, it's likely due to expense edit
        if (isStaleDataError(error)) {
          toast.error(m.payment_operation_expenseModified(), {
            duration: 3000,
          });

          // Force a full page refresh to get the latest data
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error(error instanceof Error ? error.message : m.payment_operation_approveFailed());
        }
      } finally {
        setIsProcessingClaim((prev) => ({ ...prev, [participantId]: false }));
      }
    },
    [refreshExpenseData, fetchPendingClaims, router]
  );

  /**
   * View payment proof for a pending payment claim
   */
  const handleViewPendingPaymentProof = useCallback(async (paymentId: number) => {
    try {
      const proofData = await getPaymentProofUrlByPaymentId({ data: { paymentId } });
      if (proofData.url) {
        return proofData.url;
      }
      toast.error(m.payment_toast_proofNotFound());
      return null;
    } catch (_error) {
      toast.error(m.payment_toast_proofLoadFailed());
      return null;
    }
  }, []);

  /**
   * Handle payment claim submission with proper state management
   */
  const handlePaymentClaimSubmission = useCallback(
    async (participantId: number, formData: FormData) => {
      setIsProcessingClaim((prev) => ({ ...prev, [participantId]: true }));

      try {
        await claimPayment({ data: formData });

        // Show success toast with undo functionality
        toast.success(m.payment_modal_claimSubmitted(), {
          description: m.payment_modal_claimPendingApproval(),
          action: {
            label: m.payment_modal_undo(),
            onClick: async () => {
              try {
                await undoClaim({
                  data: { participantId, type: 'PENDING' },
                });
                toast.success(m.payment_modal_claimCancelled());
                // Refresh data after undo
                await Promise.all([refreshExpenseData(), fetchPendingClaims()]);
              } catch (_error) {
                toast.error(m.payment_modal_cancelFailed());
              }
            },
          },
          duration: 10000,
        });

        // Refresh data
        await Promise.all([refreshExpenseData(), fetchPendingClaims()]);

        return { success: true };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : m.payment_modal_submitFailed());
        throw error;
      } finally {
        setIsProcessingClaim((prev) => ({ ...prev, [participantId]: false }));
      }
    },
    [refreshExpenseData, fetchPendingClaims]
  );

  /**
   * Clear pending claims state - useful before expense updates
   */
  const clearPendingClaims = useCallback(() => {
    setPendingClaimsByColleague({});
  }, []);

  return {
    isProcessingClaim,
    isToastActionActive,
    pendingClaimsByColleague,
    refreshExpenseData,
    fetchPendingClaims,
    clearPendingClaims,
    handleUndoPaymentClaim,
    handleApprovePaymentClaim,
    handleViewPendingPaymentProof,
    handlePaymentClaimSubmission,
  };
};
