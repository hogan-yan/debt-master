import { useState } from 'react';
import { toast } from 'sonner';
import { filterExpensesByColleagues, getColleaguesFromExpenses } from '@/lib/expense-filters';
import { m } from '@/paraglide/messages';
import { claimPayment, getExpenseReceiptUrl } from '@/server/expenses';
import type { Expense } from '@/types';

/**
 * Custom hook for managing expense list operations
 * Handles filtering, searching, pagination, and expense actions
 */
export const useExpenseList = () => {
  const [isProcessingClaim, setIsProcessingClaim] = useState<Record<number, boolean>>({});
  const [receiptUrls, setReceiptUrls] = useState<Record<number, string>>({});
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);
  const [currentReceiptTitle, setCurrentReceiptTitle] = useState<string>('');

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'pending'>(
    'all'
  );
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'restaurant'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /**
   * Filter and sort expenses based on current filters
   */
  const filterAndSortExpenses = (expenses: Expense[]) => {
    let filtered = expenses;

    // Apply colleague filter (filter by selected colleagues)
    if (selectedColleagueIds.length > 0) {
      filtered = filterExpensesByColleagues(filtered, selectedColleagueIds);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (expense) =>
          expense.restaurant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((expense) => {
        const participants = expense.participants || [];
        const paidCount = participants.filter((p) => p.isPaid).length;
        const totalCount = participants.length;

        switch (selectedStatus) {
          case 'paid':
            return paidCount === totalCount && totalCount > 0;
          case 'unpaid':
            return paidCount === 0;
          case 'pending':
            return paidCount > 0 && paidCount < totalCount;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'restaurant':
          aValue = a.restaurant?.name || '';
          bValue = b.restaurant?.name || '';
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return filtered;
  };

  /**
   * Handle payment claim for a participant
   */
  const handlePaymentClaim = async (participantId: number) => {
    setIsProcessingClaim((prev) => ({ ...prev, [participantId]: true }));

    try {
      const formData = new FormData();
      formData.append('participantId', participantId.toString());
      await claimPayment({ data: formData });
      toast.success(m.expense_toast_paymentClaimed());
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.expense_toast_paymentClaimFailed());
      return false;
    } finally {
      setIsProcessingClaim((prev) => ({ ...prev, [participantId]: false }));
    }
  };

  /**
   * Handle viewing receipt for an expense
   */
  const handleViewReceipt = async (expenseId: number, restaurantName?: string) => {
    try {
      // Check if we already have the receipt URL cached
      if (receiptUrls[expenseId]) {
        setCurrentReceiptUrl(receiptUrls[expenseId]);
        setCurrentReceiptTitle(restaurantName || 'Receipt');
        setIsReceiptModalOpen(true);
        return;
      }

      // Fetch receipt URL
      const receiptData = await getExpenseReceiptUrl({ data: { expenseId } });

      if (receiptData.url) {
        // Cache the URL
        setReceiptUrls((prev) => ({ ...prev, [expenseId]: receiptData.url }));
        setCurrentReceiptUrl(receiptData.url);
        setCurrentReceiptTitle(restaurantName || 'Receipt');
        setIsReceiptModalOpen(true);
      } else {
        toast.error(m.expense_toast_noReceipt());
      }
    } catch (_error) {
      toast.error(m.expense_toast_receiptLoadFailed());
    }
  };

  /**
   * Close receipt modal
   */
  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setCurrentReceiptUrl(null);
    setCurrentReceiptTitle('');
  };

  /**
   * Reset all filters
   */
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedColleagueIds([]);
    setSortBy('date');
    setSortOrder('desc');
  };

  /**
   * Get summary statistics for filtered expenses
   */
  const getExpenseSummary = (expenses: Expense[]) => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalPaid = expenses.reduce((sum, expense) => {
      const paidAmount =
        expense.participants?.reduce((pSum: number, p) => (p.isPaid ? pSum + p.amount : pSum), 0) ||
        0;
      return sum + paidAmount;
    }, 0);

    return {
      totalExpenses: expenses.length,
      totalAmount: total,
      totalPaid,
      totalOutstanding: total - totalPaid,
      averageExpense: expenses.length > 0 ? total / expenses.length : 0,
    };
  };

  return {
    // State
    isProcessingClaim,
    receiptUrls,
    isReceiptModalOpen,
    currentReceiptUrl,
    currentReceiptTitle,
    searchTerm,
    selectedStatus,
    selectedColleagueIds,
    sortBy,
    sortOrder,

    // Actions
    handlePaymentClaim,
    handleViewReceipt,
    closeReceiptModal,
    filterAndSortExpenses,
    resetFilters,
    getExpenseSummary,
    getColleaguesFromExpenses,

    // Setters
    setSearchTerm,
    setSelectedStatus,
    setSelectedColleagueIds,
    setSortBy,
    setSortOrder,
  };
};
