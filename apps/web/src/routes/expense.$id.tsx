/**
 * Individual expense detail page - shareable via URL
 * Optimized for sharing with colleagues after lunch
 */

import {
  AdminActions,
  ExpenseHeader,
  ExpenseInfoCard,
  ExpenseModals,
  ExpenseParticipants,
  ExpenseReceipt,
  PaymentSummary,
} from '@/components/expense';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UnifiedPaymentModal } from '@/components/ui/unified-payment-modal';
import { useFormSubmission } from '@/hooks';
import { usePaymentOperations } from '@/hooks/use-payment-operations';
import {
  deleteExpense,
  duplicateExpense,
  getExpenseRelatedPayments,
  updateExpense,
} from '@/server/expenses';
import { applyUnusedFundsToExpense } from '@/server/payments/mutations';
import { ExpenseItem, ExpenseParticipantWithColleague, SplitType } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface ExpenseFormInput {
  date: string;
  restaurantId: number;
  amount: number;
  splitType: SplitType;
  participantIds: number[];
  items?: { name?: string; price: number; colleagueId: number }[] | undefined;
  notes?: string | undefined;
  receiptFile?: File | undefined;
  removeExistingReceipt?: boolean | undefined;
  pendingClaimsChoice?: 'keep' | 'cancel' | 'adjust' | undefined;
}

import { createFileRoute, notFound, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { m } from '@/paraglide/messages';
import { COLLEAGUE_DETAIL } from '@/test/test-ids';
import { isAuthError } from '@/utils/auth-client';
import { ErrorCode, isAppError } from '@/utils/errors';
import { ProtectedRoute } from '@/utils/route-protection';

export const Route = createFileRoute('/expense/$id')({
  component: ExpenseDetailPage,
  loader: async ({ params }) => {
    const expenseId = Number.parseInt(params.id, 10);

    if (Number.isNaN(expenseId)) {
      throw notFound();
    }

    try {
      // Lazy import server functions to avoid TDZ issues during build
      const { getExpenseById } = await import('@/server/expenses');
      const { getActiveColleagues } = await import('@/server/colleagues/handlers');
      const { getRestaurants } = await import('@/server/restaurants/restaurant-queries');
      const { getUnappliedFundsForAllColleagues } = await import('@/server/colleagues/handlers');

      const [expense, colleagues, restaurants, unappliedFunds] = await Promise.all([
        getExpenseById({ data: { id: expenseId } }),
        getActiveColleagues(),
        getRestaurants(),
        getUnappliedFundsForAllColleagues({ data: undefined }),
      ]);
      return { expense, colleagues, restaurants, unappliedFunds };
    } catch (error) {
      if (isAuthError(error)) {
        return { expense: null, colleagues: [], restaurants: [], unappliedFunds: [] };
      }
      // Unknown / deleted expense → the proper 404 page, not the generic
      // error boundary. Other failures rethrow untouched: wrapping the raw
      // message into a new Error leaked underlying error text into the UI.
      if (isAppError(error) && error.code === ErrorCode.NOT_FOUND_EXPENSE) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({
    meta: [{ title: `${m.expense_detail_title()} — ${m.appTitle()}` }],
  }),
});

function ExpenseDetailPage() {
  const { expense, colleagues, restaurants, unappliedFunds } = Route.useLoaderData();
  const router = useRouter();

  const [selectedParticipant, setSelectedParticipant] =
    useState<ExpenseParticipantWithColleague | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [isPaymentProofModalOpen, setIsPaymentProofModalOpen] = useState(false);
  const [isPaymentClaimModalOpen, setIsPaymentClaimModalOpen] = useState(false);

  // Edit modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [hasRelatedPayments, setHasRelatedPayments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    isProcessingClaim,
    pendingClaimsByColleague,
    refreshExpenseData,
    fetchPendingClaims,
    clearPendingClaims,
    handleUndoPaymentClaim,
    handleApprovePaymentClaim,
    handleViewPendingPaymentProof,
    handlePaymentClaimSubmission,
  } = usePaymentOperations();

  const { handleSubmit } = useFormSubmission({
    onSuccess: async () => {
      setIsEditModalOpen(false);

      // Clear pending claims state to avoid stale participant IDs
      clearPendingClaims();

      // Refresh the page data to get updated expense information
      await Promise.all([
        router.invalidate(),
        refreshExpenseData(expense?.restaurantId ?? 0),
        fetchPendingClaims(expense?.restaurantId ?? 0),
      ]);
    },
    successTitle: m.common_success(),
    errorTitle: m.common_error(),
  });

  // Fetch pending claims on component mount
  useEffect(() => {
    if (!expense) return;
    fetchPendingClaims(expense.restaurantId);
  }, [expense, fetchPendingClaims]);

  if (!expense) {
    return <ProtectedRoute hasSsrData={false}>{null}</ProtectedRoute>;
  }

  /**
   * Open the unified payment modal for a participant
   */
  const handleOpenUnifiedPaymentModal = (participant: ExpenseParticipantWithColleague) => {
    setSelectedParticipant(participant);
    setIsPaymentClaimModalOpen(true);
  };

  /**
   * Handle viewing payment proof for pending claims
   */
  const handleViewPaymentProof = async (paymentId: number) => {
    const url = await handleViewPendingPaymentProof(paymentId);
    if (url) {
      setPaymentProofUrl(url);
      setSelectedParticipant(null);
      setIsPaymentProofModalOpen(true);
    }
  };

  /**
   * Handle assigning a participant's debt to their credit balance
   */
  const handleAssignToPrepayment = async (participantId: number) => {
    await handleSubmit(async () => {
      const result = await applyUnusedFundsToExpense({
        data: { participantId },
      });
      return {
        success: result.success,
        message: m.expense_detail_toast_appliedCredit({
          amount: formatCurrency(Number(result.appliedAmount) / 100),
          name: result.colleagueName,
        }),
      };
    });
  };

  /**
   * Handle expense editing
   */
  const handleEditExpense = async (formData: ExpenseFormInput) => {
    await handleSubmit(
      async () => {
        const form = new FormData();
        form.append('id', expense.id.toString());
        form.append('date', formData.date);
        form.append('restaurantId', formData.restaurantId.toString());
        form.append('amount', formData.amount.toString());
        form.append('splitType', formData.splitType);
        form.append('participantIds', JSON.stringify(formData.participantIds));
        if (formData.items && formData.items.length > 0) {
          form.append('items', JSON.stringify(formData.items));
        }
        if (formData.notes) form.append('notes', formData.notes);
        if (formData.receiptFile) form.append('receiptFile', formData.receiptFile);
        if (formData.removeExistingReceipt) form.append('removeExistingReceipt', 'true');
        await updateExpense({ data: form });
        return { success: true };
      },
      m.expense_toast_updated({ amount: formatCurrency(formData.amount) })
    );
  };

  /**
   * Handle expense duplication
   */
  const handleDuplicateExpense = async () => {
    await handleSubmit(
      async () => {
        await duplicateExpense({
          data: {
            id: expense.id,
            newDate: new Date().toISOString().split('T')[0],
          },
        });
        return { success: true };
      },
      m.expense_toast_duplicated({ amount: formatCurrency(expense.amount) })
    );
  };

  /**
   * Handle expense deletion
   */
  const handleDeleteExpense = async (deletePayments = false) => {
    setIsDeleting(true);
    await handleSubmit(async () => {
      await deleteExpense({
        data: { id: expense.id, deleteRelatedPayments: deletePayments },
      });
      toast.success(m.expense_detail_toast_deleted());
      // Navigate back to expenses list
      router.navigate({ to: '/expenses/' });
      return { success: true };
    });
    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  /**
   * Handle opening delete dialog with payment check
   */
  const handleOpenDeleteDialog = async () => {
    // Check if expense has related payments
    try {
      const { hasRelatedPayments: hasPayments } = await getExpenseRelatedPayments({
        data: { id: expense.id },
      });
      setHasRelatedPayments(hasPayments);
    } catch {
      // Fail safe: on a check error assume payments exist so the delete
      // dialog keeps its data-loss warning instead of hiding it.
      setHasRelatedPayments(true);
    }

    setIsDeleteDialogOpen(true);
  };

  // Create participant items lookup
  const participantItems =
    expense.items?.reduce(
      (acc, item) => {
        const colleagueId = item.colleague?.id;
        if (colleagueId) {
          if (!acc[colleagueId]) acc[colleagueId] = [];
          acc[colleagueId].push(item);
        }
        return acc;
      },
      {} as Record<number, ExpenseItem[]>
    ) || {};

  return (
    <ProtectedRoute>
      <div
        className="max-w-4xl mx-auto space-y-6"
        data-testid={COLLEAGUE_DETAIL.EXPENSE_DETAIL_SECTION}
      >
        {/* Header */}
        <ExpenseHeader
          restaurantName={expense.restaurant?.name}
          amount={expense.amount}
          participantCount={expense.participants?.length || 0}
          date={expense.date}
        />

        {/* Main Expense Card */}
        <ExpenseInfoCard
          amount={expense.amount}
          date={expense.date}
          restaurant={expense.restaurant}
          notes={expense.notes || undefined}
          participants={expense.participants}
        />

        {/* Receipt Section */}
        <ExpenseReceipt expenseId={expense.id} restaurantName={expense.restaurant?.name} />

        {/* Payment Status Summary */}
        <PaymentSummary participants={expense.participants || []} totalAmount={expense.amount} />

        {/* Participants Details */}
        {expense.participants && expense.participants.length > 0 && (
          <ExpenseParticipants
            participants={expense.participants}
            participantItems={participantItems}
            pendingClaimsByColleague={pendingClaimsByColleague}
            isProcessingClaim={isProcessingClaim}
            onOpenPaymentModal={handleOpenUnifiedPaymentModal}
            onApprovePayment={handleApprovePaymentClaim}
            onUndoPaymentClaim={handleUndoPaymentClaim}
            onViewPaymentProof={handleViewPaymentProof}
            onAssignToPrepayment={handleAssignToPrepayment}
            unappliedFunds={unappliedFunds}
          />
        )}

        {/* Admin Actions */}
        <AdminActions
          expenseId={expense.id}
          onEdit={() => setIsEditModalOpen(true)}
          onDuplicate={handleDuplicateExpense}
          onDelete={handleOpenDeleteDialog}
        />

        {/* Unified Payment Modal */}
        {selectedParticipant && (
          <UnifiedPaymentModal
            participant={selectedParticipant}
            isOpen={isPaymentClaimModalOpen}
            onClose={() => setIsPaymentClaimModalOpen(false)}
            onSuccess={async () => {
              // The hook handles all the data refreshing
              setIsPaymentClaimModalOpen(false);
            }}
            onSubmissionHandler={handlePaymentClaimSubmission}
            isProcessing={isProcessingClaim[selectedParticipant.id]}
          />
        )}

        {/* Edit Modal */}
        <ExpenseModals
          isAddModalOpen={false}
          isEditModalOpen={isEditModalOpen}
          isDeleteDialogOpen={isDeleteDialogOpen}
          isReceiptModalOpen={false}
          isClaimModalOpen={false}
          setIsAddModalOpen={() => {}}
          setIsEditModalOpen={setIsEditModalOpen}
          setIsDeleteDialogOpen={setIsDeleteDialogOpen}
          setIsReceiptModalOpen={() => {}}
          setIsClaimModalOpen={() => {}}
          selectedExpense={expense}
          expenseToDelete={expense}
          selectedParticipant={null}
          receiptUrl={null}
          colleagues={colleagues}
          restaurants={restaurants}
          onCreateExpense={async () => {}}
          onEditExpense={handleEditExpense}
          onDeleteConfirm={handleDeleteExpense}
          onClaimPaymentWithProof={async () => {}}
          isProcessingPaymentClaim={{}}
          hasRelatedPayments={hasRelatedPayments}
          isDeleting={isDeleting}
        />

        {/* Payment Proof Viewing Modal */}
        <Dialog open={isPaymentProofModalOpen} onOpenChange={setIsPaymentProofModalOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{m.expense_detail_paymentProof()}</DialogTitle>
            </DialogHeader>

            {paymentProofUrl && (
              <div className="space-y-4">
                <img
                  src={paymentProofUrl}
                  alt={m.expense_detail_paymentProofAlt()}
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg border"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => window.open(paymentProofUrl, '_blank')}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md"
                  >
                    {m.expense_detail_openInNewTab()}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
