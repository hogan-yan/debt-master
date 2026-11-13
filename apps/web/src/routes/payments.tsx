/**
 * Payments route - Track and manage payment records
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PaymentForm } from '@/components/forms/payment-form';
import {
  PaymentMobileCard,
  type PaymentMobileCardData,
} from '@/components/lists/payment-mobile-card';
import { Button } from '@/components/ui/button';
import { CRUDModalContainer } from '@/components/ui/crud-modal-container';
import { DataTableWithActions } from '@/components/ui/data-table-with-actions';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { PageHeader } from '@/components/ui/page-header';
import { PaymentProofViewModal } from '@/components/ui/payment-proof-modal';
import { SummaryCardsGrid } from '@/components/ui/summary-cards-grid';
import { createPaymentColumns } from '@/config/table-columns';
import { useFormSubmission } from '@/hooks';
import type { CreatePaymentSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  createPayment,
  deletePayment,
  getPaymentProofUrlByPaymentId,
  updatePayment,
} from '@/server/payments';
import { PAYMENT } from '@/test/test-ids';
import { Payment, PaymentForm as PaymentFormData } from '@/types';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';
import { ProtectedRoute } from '@/utils/route-protection';
import { usePaymentList } from './-use-payment-list';

export const Route = createFileRoute('/payments')({
  component: PaymentsPage,
  head: () => ({
    meta: [{ title: 'Payments — Debt Master' }],
  }),
  loader: async () => {
    // Lazy import server functions to avoid TDZ issues during build

    const { getPaymentsPaginated, getPaymentStats } = await import('@/server/payments');
    const { getActiveColleagues } = await import('@/server/colleagues/handlers');
    // Load initial page with default pagination
    const [paginatedPayments, stats, colleagues] = await Promise.all([
      getPaymentsPaginated({
        data: {
          page: 1,
          pageSize: 10,
          sortBy: 'date',
          sortOrder: 'desc',
        },
      }),
      getPaymentStats(),
      getActiveColleagues(),
    ]);
    return { paginatedPayments, stats, colleagues };
  },
});

function PaymentsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { paginatedPayments: initialData, stats: initialStats, colleagues } = Route.useLoaderData();

  // Determine if SSR returned real data to avoid hydration flicker
  const hasSsrData = initialData.data.length > 0 || initialStats.totalPayments > 0;

  const {
    paginatedData,
    stats,
    // listParams available if needed by future features
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleSortChange,
    refresh: refreshPayments,
  } = usePaymentList({ paginatedPayments: initialData, stats: initialStats });

  // Memoized summary cards
  const summaryCards = useMemo(
    () => [
      {
        title: m.payment_summary_total(),
        value: stats.totalPayments,
      },
      {
        title: m.payment_summary_totalAmount(),
        value: formatCurrency(stats.totalAmount),
        valueClassName: 'text-foreground',
      },
      {
        title: m.payment_summary_average(),
        value: formatCurrency(stats.averageAmount),
        valueClassName: 'text-foreground',
      },
    ],
    [stats.totalPayments, stats.totalAmount, stats.averageAmount]
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  // Payment proof viewing state
  const [isPaymentProofViewModalOpen, setIsPaymentProofViewModalOpen] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [selectedPaymentForProof, setSelectedPaymentForProof] = useState<Payment | undefined>(
    undefined
  );

  const { handleSubmit } = useFormSubmission({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      refreshPayments();
    },
  });

  const handleCreatePayment = async (formData: PaymentFormData) => {
    await handleSubmit(
      async () => {
        const form = new FormData();
        form.append('colleagueId', formData.colleagueId);
        form.append('amount', formData.amount);
        form.append('date', formData.date);
        form.append('paymentType', formData.paymentType);
        if (formData.paymentProofFile) {
          form.append('paymentProofFile', formData.paymentProofFile);
        }

        // Add expense payment specific data
        if (formData.selectedExpenseIds && formData.selectedExpenseIds.length > 0) {
          form.append('selectedExpenseIds', JSON.stringify(formData.selectedExpenseIds));
          form.append('expenseAmounts', JSON.stringify(formData.expenseAmounts || {}));
        }

        // Add expenseId if provided (legacy support)
        if (formData.expenseId) {
          form.append('expenseId', formData.expenseId.toString());
        }

        // Add restaurantId if provided
        if (formData.restaurantId) {
          form.append('restaurantId', formData.restaurantId.toString());
        }

        const result = await createPayment({ data: form });

        // Show success message with auto-payment information
        if (result.autoPayments && result.autoPayments.length > 0) {
          const autoPaymentDetails = result.autoPayments
            .map(
              (payment) =>
                `${payment.expense?.restaurant?.name || m.common_unknown()}: ${formatCurrency(payment.amount)}`
            )
            .join(', ');

          toast.success(m.payment_toast_autoApplied(), {
            description: m.payment_toast_autoAppliedDesc({
              applied: formatCurrency(result.autoAppliedAmount || 0),
              names: autoPaymentDetails,
              remaining: formatCurrency(result.remainingPrepayment || 0),
            }),
            duration: 8000,
          });
        } else if ((result.remainingPrepayment || 0) > 0) {
          toast.success(m.payment_toast_prepayment(), {
            description: m.payment_toast_prepaymentDesc({
              amount: formatCurrency(Number.parseFloat(formData.amount)),
            }),
            duration: 5000,
          });
        } else {
          // Expense payment mode
          toast.success(m.payment_toast_expensePayment(), {
            description: m.payment_toast_expensePaymentDesc({
              amount: formatCurrency(Number.parseFloat(formData.amount)),
            }),
            duration: 5000,
          });
        }

        return { success: true };
      },
      undefined // Don't show default success message since we're handling it above
    );
  };

  const handleEditPayment = async (formData: CreatePaymentSchema) => {
    if (!selectedPayment) return;

    // With the new robust `updatePayment` function, we always use a FormData object
    // to accommodate optional file uploads.
    await handleSubmit(async () => {
      const form = new FormData();
      form.append('id', selectedPayment.id.toString());
      form.append('colleagueId', formData.colleagueId);
      // IMPORTANT: Use the original payment amount from initialData, not the calculated one
      form.append('amount', formData.amount);
      form.append('date', formData.date);
      form.append('paymentType', formData.paymentType);

      if (formData.paymentProofFile) {
        form.append('paymentProofFile', formData.paymentProofFile);
      }
      if (formData.removeExistingProof) {
        form.append('removeExistingProof', 'true');
      }

      // Always include the application data
      form.append('selectedExpenseIds', JSON.stringify(formData.selectedExpenseIds || []));
      form.append('expenseAmounts', JSON.stringify(formData.expenseAmounts || {}));

      const result = await updatePayment({ data: form });
      return { success: !!result };
    }, m.payment_toast_updated());
  };

  const handleEditClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handles viewing payment proof for a payment
   * @param payment - The payment with proof to view
   */
  const handleViewPaymentProof = async (payment: Payment) => {
    try {
      if (payment.paymentProofBucket && payment.paymentProofObjectKey) {
        const proofData = await getPaymentProofUrlByPaymentId({ data: { paymentId: payment.id } });
        if (proofData.url) {
          setPaymentProofUrl(proofData.url);
          setSelectedPaymentForProof(payment);
          setIsPaymentProofViewModalOpen(true);
        } else {
          toast.error(m.payment_toast_proofNotFound());
        }
      } else {
        toast.error(m.payment_toast_noProof());
      }
    } catch (_error) {
      toast.error(m.payment_toast_proofLoadFailed());
    }
  };

  /**
   * Handles navigation to related expense
   * @param payment - The payment with related expense
   */
  const handleGoToExpense = (payment: Payment) => {
    if (payment.expense) {
      router.navigate({ to: `/expense/${payment.expense.id}` });
    } else {
      toast.error(m.payment_toast_noRelatedExpense());
    }
  };

  /**
   * Handles navigation to a specific expense by ID
   * @param expenseId - The ID of the expense to navigate to
   */
  const handleGoToSpecificExpense = (expenseId: number) => {
    router.navigate({ to: `/expense/${expenseId}` });
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;

    await handleSubmit(async () => {
      await deletePayment({ data: { id: paymentToDelete.id } });
      return { success: true };
    }, m.payment_toast_deleted());

    setIsDeleteDialogOpen(false);
    setPaymentToDelete(null);
  };

  // Memoized edit form initialData to prevent unnecessary PaymentForm re-renders
  const editFormInitialData = useMemo(() => {
    if (!selectedPayment) return undefined;
    return {
      colleagueId: selectedPayment.colleagueId.toString(),
      amount: selectedPayment.amount.toString(),
      date:
        typeof selectedPayment.date === 'string'
          ? selectedPayment.date
          : selectedPayment.date.toISOString().split('T')[0],
      paymentType: selectedPayment.paymentType,
      paymentId: selectedPayment.id,
      hasExistingPaymentProof: !!(
        selectedPayment.paymentProofBucket && selectedPayment.paymentProofObjectKey
      ),
      expenseId: selectedPayment.expenseId || undefined,
      applications: (selectedPayment.applications || []).map((app) => ({
        id: app.id,
        amount: app.amount,
        expense: app.expense ? { id: app.expense.id } : undefined,
      })),
    };
  }, [selectedPayment]);

  // Action handler for mobile card menu actions
  const handlePaymentCardAction = async (
    action: string,
    payment: PaymentMobileCardData,
    extra?: { expenseId?: number }
  ) => {
    if (action === 'edit') {
      // Fetch full payment data for mobile edit to ensure all fields are available
      try {
        const { getPaymentById } = await import('@/server/payments');
        const fullPayment = await getPaymentById({ data: { id: payment.id } });
        handleEditClick(fullPayment);
      } catch (_error) {
        toast.error(m.payment_toast_editLoadFailed());
      }
      return;
    }

    // Reconstruct minimal Payment object for existing handlers
    const minimalPayment = { id: payment.id } as Payment;
    if (action === 'delete') handleDeleteClick(minimalPayment);
    if (action === 'viewProof') handleViewPaymentProof(minimalPayment);
    if (action === 'goToExpense' && payment.expenseId)
      router.navigate({ to: `/expense/${payment.expenseId}` });
    if (action === 'goToSpecificExpense' && extra?.expenseId)
      router.navigate({ to: `/expense/${extra.expenseId}` });
  };

  /** Maps a Payment object to PaymentMobileCardData */
  const toMobileCardPayment = (payment: Payment): PaymentMobileCardData => ({
    id: payment.id,
    colleagueName: payment.colleague?.name ?? m.common_unknown(),
    amount: payment.amount,
    paymentType: payment.paymentType,
    date: typeof payment.date === 'string' ? payment.date : payment.date.toISOString(),
    isApproved: payment.isApproved,
    expenseName: payment.expense?.restaurant?.name ?? null,
    expenseId: payment.expense?.id ?? null,
    restaurantName: payment.restaurant?.name ?? undefined,
    hasProof: !!(payment.paymentProofBucket && payment.paymentProofObjectKey),
    applications: (payment.applications ?? []).map((app) => ({
      amount: app.amount,
      ...(app.expense?.restaurant?.name != null
        ? { expenseName: app.expense.restaurant.name }
        : {}),
      ...(app.expense?.id != null ? { expenseId: app.expense.id } : {}),
    })),
    ...(payment.createdBy != null ? { createdBy: payment.createdBy } : {}),
  });

  return (
    <ProtectedRoute hasSsrData={hasSsrData}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={m.payment_pageTitle()}
          subtitle={m.payment_pageSubtitle()}
          data-testid={PAYMENT.TRACKING_HEADING}
          action={
            <AdminOnly>
              <Button onClick={() => setIsAddModalOpen(true)} data-testid={PAYMENT.ADD_PAYMENT_BTN}>
                {m.payment_recordPayment()}
              </Button>
            </AdminOnly>
          }
        />

        {/* Summary Cards — collapsible on mobile, always visible on desktop */}
        <div className="block sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSummaryVisible(!isSummaryVisible)}
            className="w-full text-muted-foreground justify-between"
          >
            <span>
              {isSummaryVisible ? m.payment_hideStats() : m.payment_showStats()} {m.payment_stats()}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isSummaryVisible && 'rotate-180'
              )}
            />
          </Button>
          {isSummaryVisible && (
            <div className="mt-2">
              <SummaryCardsGrid cards={summaryCards} />
            </div>
          )}
        </div>
        <div className="hidden sm:block">
          <SummaryCardsGrid cards={summaryCards} />
        </div>

        {/* Payments Table */}
        <DataTableWithActions
          title={m.payment_history()}
          columns={createPaymentColumns({
            onEdit: handleEditClick,
            onDelete: handleDeleteClick,
            onViewPaymentProof: handleViewPaymentProof,
            onGoToExpense: handleGoToExpense,
            onGoToSpecificExpense: handleGoToSpecificExpense,
            isAdmin,
          })}
          data={paginatedData.data}
          pagination={paginatedData.pagination}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          searchPlaceholder={m.payment_search_placeholder()}
          searchUiVariant="expense"
          isLoading={isLoading}
          mobileCardView={true}
          renderMobileCard={(payment: Payment) => (
            <PaymentMobileCard
              key={payment.id}
              payment={toMobileCardPayment(payment)}
              onAction={handlePaymentCardAction}
            />
          )}
          emptyStateComponent={
            stats.totalPayments === 0 ? (
              <AdminOnly>
                <EmptyStateWithAction
                  actionText={m.payment_empty_recordFirst()}
                  onAction={() => setIsAddModalOpen(true)}
                />
              </AdminOnly>
            ) : null
          }
        />

        {/* Payment Proof View Modal */}
        <PaymentProofViewModal
          isOpen={isPaymentProofViewModalOpen}
          onClose={() => {
            setIsPaymentProofViewModalOpen(false);
            setPaymentProofUrl(null);
            setSelectedPaymentForProof(undefined);
          }}
          paymentProofUrl={paymentProofUrl}
          payment={selectedPaymentForProof}
        />

        {/* Record Payment Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isAddModalOpen}
            onOpenChange={setIsAddModalOpen}
            title={m.payment_recordPayment()}
            maxWidth="lg"
            data-testid={PAYMENT.RECORD_PAYMENT_DIALOG}
          >
            <PaymentForm
              colleagues={colleagues}
              onClose={() => setIsAddModalOpen(false)}
              onSubmit={handleCreatePayment}
            />
          </CRUDModalContainer>
        </AdminOnly>

        {/* Edit Payment Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            title={m.payment_modal_editTitle()}
            maxWidth="lg"
          >
            {selectedPayment && (
              <PaymentForm
                colleagues={colleagues}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditPayment}
                initialData={editFormInitialData}
              />
            )}
          </CRUDModalContainer>
        </AdminOnly>

        {/* Delete Confirmation Dialog - Admin Only */}
        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            message={
              paymentToDelete ? (
                <p>
                  {m.payment_dialog_deleteMessage({
                    amount: formatCurrency(paymentToDelete.amount),
                    name: paymentToDelete.colleague?.name || m.payment_unknownColleague(),
                  })}
                </p>
              ) : (
                ''
              )
            }
            onConfirm={confirmDelete}
          />
        </AdminOnly>
      </div>
    </ProtectedRoute>
  );
}
