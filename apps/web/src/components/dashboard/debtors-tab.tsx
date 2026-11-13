/**
 * Dashboard debtors tab component
 * Shows who owes money and their debt details
 */

import { useRouter } from '@tanstack/react-router';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  DollarSign,
  ExternalLink,
  Receipt,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { BulkClaimModal } from '@/components/admin/bulk-claim-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormSubmission } from '@/hooks';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import { bulkClaimForColleague } from '@/server/payments/mutations';
import {
  claimAllBtnId,
  DEBTORS,
  debtorCardId,
  debtorExpandToggleId,
  unpaidExpenseDesktopId,
  unpaidExpenseId,
  unpaidExpensesDesktopId,
  unpaidExpensesHeadingId,
} from '@/test/test-ids';
import { useAuth } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';

export async function runBulkClaimForDebtor<TDebtor>(
  selectedDebtor: TDebtor | null,
  run: (debtor: TDebtor) => Promise<void>
): Promise<void> {
  if (!selectedDebtor) return;
  await run(selectedDebtor);
}

interface UnpaidExpense {
  id: number;
  date: string | Date;
  restaurantName: string;
  restaurantId?: number | null;
  totalAmount: number;
  colleagueAmount: number;
  participantId: number;
  notes?: string | null;
  participantCount: number;
  splitType: string;
  remainingOwed: number;
  totalApprovedPaid: number;
}

interface Debtor {
  id: number;
  name: string;
  currentBalance: number;
  daysSinceLastPayment: number;
  unpaidExpenses: UnpaidExpense[];
}

interface DebtorsTabProps {
  validDebtors: Debtor[];
}

/**
 * Format date for display
 */
const formatDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString(getLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Open expense in new tab
 */
const openExpenseInNewTab = (expenseId: number) => {
  const url = `/expense/${expenseId}`;
  window.open(url, '_blank');
};

/**
 * Dashboard debtors tab
 */
export function DebtorsTab({ validDebtors }: DebtorsTabProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [expandedDebtors, setExpandedDebtors] = useState<Set<number>>(new Set());
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [isBulkClaimModalOpen, setIsBulkClaimModalOpen] = useState(false);

  const { handleSubmit, isSubmitting } = useFormSubmission({
    successMessage: m.dashboard_paymentCreatedSuccess(),
    shouldRefresh: false,
  });

  const toggleExpanded = (debtorId: number) => {
    const newExpanded = new Set(expandedDebtors);
    if (newExpanded.has(debtorId)) {
      newExpanded.delete(debtorId);
    } else {
      newExpanded.add(debtorId);
    }
    setExpandedDebtors(newExpanded);
  };

  const handleBulkClaim = async (paymentType: string) => {
    await runBulkClaimForDebtor(selectedDebtor, async (debtor) => {
      await handleSubmit(
        async () => {
          await bulkClaimForColleague({
            data: {
              colleagueId: debtor.id,
              paymentType: paymentType as 'PAYME' | 'FPS' | 'CASH' | 'OTHER',
            },
          });
          setIsBulkClaimModalOpen(false);
          setSelectedDebtor(null);

          // Refresh data after successful bulk claim
          await router.invalidate();
        },
        m.dashboard_claimedSuccess({
          amount: formatCurrency(Math.abs(debtor.currentBalance)),
          name: debtor.name,
        })
      );
    });
  };

  const openBulkClaimModal = (debtor: Debtor, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDebtor(debtor);
    setIsBulkClaimModalOpen(true);
  };

  return (
    <div className="space-y-6" data-testid={DEBTORS.DEBTORS_TAB}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Crown className="h-5 w-5" />
            <span data-testid={DEBTORS.DEBTORS_TAB_HEADING}>{m.dashboard_whoNeedsToPay()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validDebtors.length === 0 ? (
            <div className="text-center py-8">
              <div className="mb-4 flex justify-center">
                <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 text-foreground" />
              </div>
              <h3
                className="text-xl sm:text-2xl font-bold mb-2 text-foreground"
                data-testid={DEBTORS.EVERYONE_PAID_UP_EMPTY}
              >
                {m.dashboard_allPaidUp()}
              </h3>
              <p className="text-muted-foreground">{m.dashboard_noOutstandingDebts()}</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {validDebtors.map((debtor, index) => {
                const isExpanded = expandedDebtors.has(debtor.id);

                return (
                  <div
                    key={debtor.id}
                    data-testid={debtorCardId(debtor.id)}
                    className="border-2 border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    {/* Debtor Header - Mobile Optimized */}
                    <div
                      role="button"
                      tabIndex={0}
                      data-testid={debtorExpandToggleId(debtor.id)}
                      onClick={() => toggleExpanded(debtor.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpanded(debtor.id);
                        }
                      }}
                      className="p-4 sm:p-6 cursor-pointer"
                    >
                      {/* Mobile Layout */}
                      <div className="block sm:hidden space-y-3">
                        <div className="flex items-center space-x-3">
                          <div
                            data-testid={DEBTORS.DEBTOR_RANK_BADGE}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0"
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              data-testid={DEBTORS.DEBTOR_NAME}
                              className="font-bold text-foreground text-lg truncate"
                            >
                              {debtor.name}
                            </p>
                            <p
                              data-testid={DEBTORS.DEBTOR_OWES_AMOUNT}
                              className="text-destructive-text font-semibold text-base"
                            >
                              {m.dashboard_owes({
                                amount: formatCurrency(Math.abs(debtor.currentBalance)),
                              })}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span data-testid={DEBTORS.DEBTOR_DAYS_TEXT}>
                            {m.dashboard_daysSincePayment({ count: debtor.daysSinceLastPayment })}
                          </span>
                          <Badge
                            data-testid={DEBTORS.DEBTOR_UNPAID_BADGE}
                            variant="outline"
                            className="text-xs"
                          >
                            {m.dashboard_unpaidCount({ count: debtor.unpaidExpenses.length })}
                          </Badge>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden sm:flex sm:items-center sm:justify-between">
                        <div className="flex items-center space-x-4 min-w-0 flex-1">
                          <div
                            data-testid={DEBTORS.DEBTOR_RANK_BADGE}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0"
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              data-testid={DEBTORS.DEBTOR_NAME}
                              className="font-bold text-foreground text-lg truncate"
                            >
                              {debtor.name}
                            </p>
                            <p
                              data-testid={DEBTORS.DEBTOR_OWES_AMOUNT}
                              className="text-destructive-text font-semibold"
                            >
                              {m.dashboard_owes({
                                amount: formatCurrency(Math.abs(debtor.currentBalance)),
                              })}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span data-testid={DEBTORS.DEBTOR_DAYS_TEXT}>
                                {m.dashboard_daysSincePayment({
                                  count: debtor.daysSinceLastPayment,
                                })}
                              </span>
                              <Badge
                                data-testid={DEBTORS.DEBTOR_UNPAID_BADGE}
                                variant="outline"
                                className="text-xs"
                              >
                                {m.dashboard_unpaidExpensesCount({
                                  count: debtor.unpaidExpenses.length,
                                })}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.navigate({ to: '/expenses/' });
                            }}
                            className="border-primary text-primary hover:bg-primary hover:text-white"
                          >
                            {m.dashboard_viewAllExpenses()}
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Unpaid Expenses List */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/50">
                        <div className="p-4 sm:p-6">
                          <h4
                            className="text-base font-medium text-foreground mb-4 flex items-center"
                            data-testid={unpaidExpensesHeadingId(debtor.id)}
                          >
                            <Receipt className="h-5 w-5 mr-2" />
                            {m.dashboard_unpaidExpensesTitle({
                              count: debtor.unpaidExpenses.length,
                            })}
                          </h4>

                          {/* Mobile Expense Cards */}
                          <div className="block sm:hidden space-y-3">
                            {debtor.unpaidExpenses.map((expense) => (
                              <div
                                key={expense.id}
                                data-testid={unpaidExpenseId(debtor.id, expense.id)}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExpenseInNewTab(expense.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openExpenseInNewTab(expense.id);
                                  }
                                }}
                                className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-border transition"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p
                                        data-testid={DEBTORS.EXPENSE_RESTAURANT_NAME}
                                        className="font-semibold text-foreground text-base truncate"
                                      >
                                        {expense.restaurantName}
                                      </p>
                                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {formatDate(expense.date)}
                                      </p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <div className="flex items-center space-x-3">
                                      <Badge
                                        data-testid={DEBTORS.EXPENSE_PARTICIPANT_COUNT_BADGE}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        <Users className="h-3 w-3 mr-1" />
                                        {expense.participantCount}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {m.dashboard_totalLabel({
                                          amount: formatCurrency(expense.totalAmount),
                                        })}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <p
                                        data-testid={DEBTORS.EXPENSE_REMAINING_AMOUNT}
                                        className="font-bold text-destructive-text text-base"
                                      >
                                        {formatCurrency(expense.remainingOwed)}
                                      </p>
                                      <p
                                        data-testid={DEBTORS.EXPENSE_COLLEAGUE_AMOUNT}
                                        className="text-xs text-muted-foreground"
                                      >
                                        {m.dashboard_ofAmount({
                                          amount: formatCurrency(expense.colleagueAmount),
                                        })}
                                      </p>
                                    </div>
                                  </div>

                                  {expense.totalApprovedPaid > 0 && (
                                    <p className="text-sm text-success pt-1">
                                      ✓{' '}
                                      {m.dashboard_paidLabel({
                                        amount: formatCurrency(expense.totalApprovedPaid),
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Expense Cards */}
                          <div
                            className="hidden sm:block space-y-3"
                            data-testid={unpaidExpensesDesktopId(debtor.id)}
                          >
                            {debtor.unpaidExpenses.map((expense) => (
                              <div
                                key={expense.id}
                                data-testid={unpaidExpenseDesktopId(debtor.id, expense.id)}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExpenseInNewTab(expense.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openExpenseInNewTab(expense.id);
                                  }
                                }}
                                className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:shadow-sm hover:border-border cursor-pointer transition"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <p
                                      data-testid={DEBTORS.EXPENSE_RESTAURANT_NAME}
                                      className="font-medium text-foreground truncate"
                                    >
                                      {expense.restaurantName}
                                    </p>
                                    <Badge
                                      data-testid={DEBTORS.EXPENSE_PARTICIPANT_COUNT_BADGE}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      <Users className="h-3 w-3 mr-1" />
                                      {expense.participantCount}
                                    </Badge>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                    <span className="flex items-center">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {formatDate(expense.date)}
                                    </span>
                                    <span className="flex items-center">
                                      <DollarSign className="h-3 w-3 mr-1" />
                                      {m.dashboard_totalLabel({
                                        amount: formatCurrency(expense.totalAmount),
                                      })}
                                    </span>
                                  </div>
                                  {expense.notes && (
                                    <p className="text-sm text-muted-foreground mt-1 truncate">
                                      {expense.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end space-y-1 ml-4">
                                  <span
                                    data-testid={DEBTORS.EXPENSE_REMAINING_AMOUNT}
                                    className="font-semibold text-destructive-text text-lg"
                                  >
                                    {formatCurrency(expense.remainingOwed)}
                                  </span>
                                  <span
                                    data-testid={DEBTORS.EXPENSE_COLLEAGUE_AMOUNT}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {m.dashboard_ofAmount({
                                      amount: formatCurrency(expense.colleagueAmount),
                                    })}
                                  </span>
                                  {expense.totalApprovedPaid > 0 && (
                                    <span className="text-sm text-success">
                                      ✓{' '}
                                      {m.dashboard_paidLabel({
                                        amount: formatCurrency(expense.totalApprovedPaid),
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Bulk Claim Button - Only show for admins when there's unpaid balance (negative currentBalance) */}
                          {isAdmin && debtor.currentBalance < 0 && (
                            <div className="mt-4 pt-4 border-t border-border flex justify-end">
                              <Button
                                data-testid={claimAllBtnId(debtor.id)}
                                onClick={(e) => openBulkClaimModal(debtor, e)}
                                className="w-full sm:w-auto h-9"
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                {m.dashboard_claimAll({
                                  amount: formatCurrency(Math.abs(debtor.currentBalance)),
                                })}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Claim Confirmation Modal */}
      <BulkClaimModal
        open={isBulkClaimModalOpen}
        onOpenChange={setIsBulkClaimModalOpen}
        debtor={selectedDebtor}
        onConfirm={handleBulkClaim}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
