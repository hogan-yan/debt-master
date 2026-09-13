/**
 * Expenses route - Manage expense records and split calculations
 */

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExpenseList, ExpenseModals } from '@/components/expense';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PendingClaimsCard } from '@/components/ui/pending-claims-card';
import { SummaryCardsGrid } from '@/components/ui/summary-cards-grid';
import { useFormSubmission } from '@/hooks';
import { useExpenseList } from '@/hooks/use-expense-list';
import { usePaymentOperations } from '@/hooks/use-payment-operations';
import { m } from '@/paraglide/messages';
import {
  claimPayment,
  createExpense,
  deleteExpense,
  duplicateExpense,
  getExpenseReceiptUrl,
  getExpenseRelatedPayments,
  getExpenseStats,
  getExpensesPaginated,
  updateExpense,
} from '@/server/expenses';
import { EXPENSE } from '@/test/test-ids';
import { Expense } from '@/types';
import { SplitType } from '@/types/common';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';
import { ProtectedRoute } from '@/utils/route-protection';

/** Expense form data structure shared between routes */
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

export const Route = createFileRoute('/expenses')({
  component: ExpensesPage,
  head: () => ({
    meta: [{ title: `${m.nav_expenses()} — ${m.appTitle()}` }],
  }),
  loader: async () => {
    // Lazy import server functions to avoid TDZ issues during build
    const { getExpensesPaginated, getExpenseStats, getPendingPaymentClaims } = await import(
      '@/server/expenses'
    );
    const { getActiveColleagues } = await import('@/server/colleagues/handlers');
    const { getRestaurants } = await import('@/server/restaurants/restaurant-queries');

    const [paginatedExpenses, stats, colleagues, restaurants, pendingClaims] = await Promise.all([
      getExpensesPaginated({
        data: { page: 1, pageSize: 10, sortBy: 'date', sortOrder: 'desc' },
      }),
      getExpenseStats(),
      getActiveColleagues(),
      getRestaurants(),
      getPendingPaymentClaims(),
    ]);
    return { paginatedExpenses, stats, colleagues, restaurants, pendingClaims };
  },
});

function ExpensesPage() {
  useAuth(); // Verify authentication
  const {
    paginatedExpenses: initialData,
    stats: initialStats,
    colleagues,
    restaurants,
    pendingClaims: initialPendingClaims,
  } = Route.useLoaderData();

  // Determine if SSR returned real data to avoid hydration flicker
  const hasSsrData = initialData.data.length > 0 || initialStats.totalExpenses > 0;

  // Pagination/filter state — the single source of truth for the query key.
  // Mutations invalidate the ['expenses'] query instead of bouncing through
  // router.invalidate(), so a refetch never resets page/filters/sort.
  const queryClient = useQueryClient();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<
    'date' | 'amount' | 'splitType' | 'restaurant' | 'createdAt'
  >('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<
    'all' | 'paid' | 'unpaid' | 'partial'
  >('all');

  // List + stats live in react-query, keyed by the current view parameters.
  const expensesQuery = useQuery({
    queryKey: [
      'expenses',
      'list',
      {
        page: currentPage,
        pageSize,
        search: searchQuery,
        sortBy,
        sortOrder,
        colleagueIds: selectedColleagueIds,
        paymentStatus: selectedPaymentStatus,
      },
    ],
    queryFn: () =>
      getExpensesPaginated({
        data: {
          page: currentPage,
          pageSize,
          search: searchQuery || undefined,
          sortBy,
          sortOrder,
          colleagueIds: selectedColleagueIds.length > 0 ? selectedColleagueIds : undefined,
          paymentStatus: selectedPaymentStatus,
        },
      }),
    // SSR data seeds the first view; keep the previous page on screen while
    // the next one loads so pagination doesn't flash empty.
    placeholderData: keepPreviousData,
    initialData: { ...initialData, data: [...initialData.data] },
  });

  const statsQuery = useQuery({
    queryKey: ['expenses', 'stats'],
    queryFn: () => getExpenseStats(),
    initialData: initialStats,
  });

  const paginatedData = expensesQuery.data ?? initialData;
  const stats = statsQuery.data ?? initialStats;
  const isLoading = expensesQuery.isFetching;

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: number;
    amount: number;
    colleague?: { id: number; name: string };
  } | null>(null);
  const [hasRelatedPayments, setHasRelatedPayments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom hooks
  const { isProcessingClaim, handleApprovePaymentClaim } = usePaymentOperations();

  const { isProcessingClaim: isProcessingPaymentClaim } = useExpenseList();

  // Receipt modal state
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  /**
   * Fetching is driven by the query key: handlers just update the parameter
   * state and react-query refetches the matching view.
   */

  /**
   * Handle pagination change
   */
  const handlePaginationChange = (page: number, newPageSize: number) => {
    setCurrentPage(page);
    setPageSize(newPageSize);
  };

  /**
   * Handle search change (resets to the first page of the new result set).
   * Unchanged text is a no-op so a re-fired callback can never reset the page.
   */
  const handleSearchChange = (search: string) => {
    if (search === searchQuery) return;
    setSearchQuery(search);
    setCurrentPage(1);
  };

  /**
   * Handle sort change
   */
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy as typeof sortBy);
    setSortOrder(newSortOrder);
  };

  /**
   * Handle viewing receipt
   */
  const handleViewReceipt = async (expense: Expense) => {
    try {
      if (expense.receiptBucket && expense.receiptObjectKey) {
        const receiptData = await getExpenseReceiptUrl({ data: { expenseId: expense.id } });
        if (receiptData.url) {
          setCurrentReceiptUrl(receiptData.url);
          setIsReceiptModalOpen(true);
        } else {
          toast.error(m.expense_toast_receiptNotFound());
        }
      } else {
        toast.error(m.expense_toast_noReceipt());
      }
    } catch (_error) {
      toast.error(m.expense_toast_receiptLoadFailed());
    }
  };

  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setCurrentReceiptUrl(null);
  };

  const { handleSubmit } = useFormSubmission({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      refreshExpenses();
    },
    successTitle: 'Success',
    errorTitle: 'Error',
  });

  /**
   * Refresh expenses data for the current view (keeps page/filters/sort).
   */
  const refreshExpenses = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  /**
   * Handle expense creation
   */
  const handleCreateExpense = async (formData: ExpenseFormInput) => {
    await handleSubmit(
      async () => {
        const form = new FormData();
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
        await createExpense({ data: form });
        return { success: true };
      },
      m.expense_toast_created({ amount: formatCurrency(formData.amount) })
    );
  };

  /**
   * Handle expense editing
   */
  const handleEditExpense = async (formData: ExpenseFormInput) => {
    if (!selectedExpense) return;
    await handleSubmit(
      async () => {
        const form = new FormData();
        form.append('id', selectedExpense.id.toString());
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
  const handleDuplicateExpense = async (expense: Expense) => {
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
  const confirmDelete = async (deletePayments = false) => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    await handleSubmit(async () => {
      await deleteExpense({
        data: { id: expenseToDelete.id, deleteRelatedPayments: deletePayments },
      });
      return { success: true };
    }, m.expense_toast_deleted());
    setIsDeleteDialogOpen(false);
    setExpenseToDelete(null);
    setIsDeleting(false);
  };

  /**
   * Handle payment claim with proof
   */
  const handleClaimPaymentWithProof = async (
    participantId: number,
    paymentProofFile?: File,
    paymentMethod: 'PAYME' | 'FPS' | 'CASH' | 'OTHER' | string = 'PAYME'
  ) => {
    try {
      const formData = new FormData();
      formData.append('participantId', participantId.toString());
      formData.append('paymentMethod', paymentMethod);
      if (paymentProofFile) {
        formData.append('paymentProofFile', paymentProofFile);
      }

      await claimPayment({ data: formData });
      toast.success(m.expense_toast_paymentClaimed());
      refreshExpenses();
      setIsClaimModalOpen(false);
      setSelectedParticipant(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.payment_modal_submitFailed());
    }
  };

  // Memoized summary cards
  const summaryCards = useMemo(
    () => [
      { title: m.expense_summary_total(), value: stats.totalExpenses },
      {
        title: m.expense_summary_totalAmount(),
        value: formatCurrency(stats.totalAmount),
        valueClassName: 'text-foreground',
      },
      {
        title: m.expense_summary_average(),
        value: formatCurrency(stats.averageAmount),
        valueClassName: 'text-foreground',
      },
      { title: m.expense_summary_restaurants(), value: stats.uniqueRestaurants },
    ],
    [stats.totalExpenses, stats.totalAmount, stats.averageAmount, stats.uniqueRestaurants]
  );

  // Handlers for actions
  const handleEditClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (expense: Expense) => {
    setExpenseToDelete(expense);

    // Check if expense has related payments
    try {
      const { hasRelatedPayments: hasPayments } = await getExpenseRelatedPayments({
        data: { id: expense.id },
      });
      setHasRelatedPayments(hasPayments);
    } catch (_error) {
      setHasRelatedPayments(false);
    }

    setIsDeleteDialogOpen(true);
  };

  /**
   * Handle colleague filter change
   */
  const handleColleagueChange = (colleagueIds: number[]) => {
    setSelectedColleagueIds(colleagueIds);
    setCurrentPage(1);
  };

  /**
   * Handle payment status filter change
   */
  const handlePaymentStatusChange = (status: 'all' | 'paid' | 'unpaid' | 'partial') => {
    setSelectedPaymentStatus(status);
    setCurrentPage(1);
  };

  const handleOpenClaimModal = (_participantId: number) => {
    // Component passes just participantId - claim modal logic is handled
    // separately through selectedParticipant state
    setIsClaimModalOpen(true);
  };

  return (
    <ProtectedRoute hasSsrData={hasSsrData}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={m.expense_pageTitle()}
          subtitle={m.expense_pageSubtitle()}
          data-testid={EXPENSE.MANAGEMENT_HEADING}
          action={
            <AdminOnly>
              <Button onClick={() => setIsAddModalOpen(true)} data-testid={EXPENSE.ADD_EXPENSE_BTN}>
                {m.expense_addExpense()}
              </Button>
            </AdminOnly>
          }
        />

        {/* Pending Claims Card - Admin Only */}
        <AdminOnly>
          <PendingClaimsCard
            initialData={initialPendingClaims}
            onApprove={handleApprovePaymentClaim}
            isProcessing={isProcessingClaim}
          />
        </AdminOnly>

        {/* Summary Cards */}
        <SummaryCardsGrid cards={summaryCards} />

        {/* Expense List */}
        <ExpenseList
          expenses={paginatedData.data}
          isLoading={isLoading}
          onViewReceipt={handleViewReceipt}
          onAddExpense={() => setIsAddModalOpen(true)}
          onPaymentClaim={handleOpenClaimModal}
          onEdit={handleEditClick}
          onDuplicate={handleDuplicateExpense}
          onDelete={handleDeleteClick}
          isProcessingClaim={isProcessingPaymentClaim}
          pagination={paginatedData.pagination}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          colleagues={colleagues}
          selectedColleagueIds={selectedColleagueIds}
          onColleagueChange={handleColleagueChange}
          selectedPaymentStatus={selectedPaymentStatus}
          onPaymentStatusChange={handlePaymentStatusChange}
        />

        {/* All Modals */}
        <ExpenseModals
          isAddModalOpen={isAddModalOpen}
          isEditModalOpen={isEditModalOpen}
          isDeleteDialogOpen={isDeleteDialogOpen}
          isReceiptModalOpen={isReceiptModalOpen}
          isClaimModalOpen={isClaimModalOpen}
          setIsAddModalOpen={setIsAddModalOpen}
          setIsEditModalOpen={setIsEditModalOpen}
          setIsDeleteDialogOpen={setIsDeleteDialogOpen}
          setIsReceiptModalOpen={closeReceiptModal}
          setIsClaimModalOpen={setIsClaimModalOpen}
          selectedExpense={selectedExpense}
          expenseToDelete={expenseToDelete}
          selectedParticipant={selectedParticipant}
          receiptUrl={currentReceiptUrl}
          colleagues={colleagues}
          restaurants={restaurants}
          onCreateExpense={handleCreateExpense}
          onEditExpense={handleEditExpense}
          onDeleteConfirm={confirmDelete}
          onClaimPaymentWithProof={handleClaimPaymentWithProof}
          isProcessingPaymentClaim={isProcessingPaymentClaim}
          hasRelatedPayments={hasRelatedPayments}
          isDeleting={isDeleting}
        />
      </div>
    </ProtectedRoute>
  );
}
