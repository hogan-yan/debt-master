import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileText,
  MapPin,
  MoreHorizontal,
  Receipt,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { EnhancedAvatar, getInitialsColor } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateWithBadge } from '@/components/ui/date-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { m } from '@/paraglide/messages';
import { EXPENSE, expenseDetailLinkId, RESTAURANT, TABLE_COL } from '@/test/test-ids';
import { Expense } from '@/types';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { formatCurrency, getExpenseStatusBadge } from '@/utils/formatters';
import { ExpenseMobileCard } from './expense-mobile-card';

// Participant pill inside the unpaid dropdown: full-white text over the
// per-name initials color. unslop-ignore
const UNPAID_PILL_CLASS = 'text-white text-xs px-2 py-1 rounded-full'; // unslop-ignore

const MOBILE_MQL = '(max-width: 1023px)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_MQL);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_MQL).matches;
}

function getServerSnapshot() {
  return false;
}

interface ColleagueOption {
  id: number;
  name: string;
}

interface ExpenseListProps {
  /** List of expenses to display */
  expenses: Expense[];
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Action handlers */
  onViewReceipt?: (expense: Expense) => void;
  onAddExpense?: () => void;
  onPaymentClaim?: (participantId: number) => void;
  onEdit?: (expense: Expense) => void;
  onDuplicate?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  /** Processing states */
  isProcessingClaim?: Record<number, boolean>;
  /** Pending claims lookup */
  pendingClaimsByColleague?: Record<
    number,
    {
      participantId: number;
      submittedAt: Date;
      hasPaymentProof: boolean;
      paymentId: number;
    }
  >;
  /** Empty state configuration */
  showEmptyAddButton?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Pagination props */
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  /** Pagination handlers */
  onPaginationChange?: (page: number, pageSize: number) => void;
  onSearchChange?: (search: string) => void;
  onSortChange?: (_sortBy: string, _sortOrder: 'asc' | 'desc') => void;
  /** Colleague filter props */
  colleagues?: ColleagueOption[];
  selectedColleagueIds?: number[];
  onColleagueChange?: (colleagueIds: number[]) => void;
  /** Payment status filter props */
  selectedPaymentStatus?: 'all' | 'paid' | 'unpaid' | 'partial';
  onPaymentStatusChange?: (status: 'all' | 'paid' | 'unpaid' | 'partial') => void;
  /** Search configuration */
  searchPlaceholder?: string;
  allowedPageSizes?: number[];
}

interface DesktopExpenseRowProps {
  expense: Expense;
  onViewReceipt?: ((expense: Expense) => void) | undefined;
  onEdit?: ((expense: Expense) => void) | undefined;
  onDuplicate?: ((expense: Expense) => void) | undefined;
  onDelete?: ((expense: Expense) => void) | undefined;
}

/**
 * Render payment status badge
 */
function renderPaymentStatusBadge(expense: Expense) {
  const badge = getExpenseStatusBadge(expense);

  const IconComponent =
    badge.icon === 'CheckCircle' ? CheckCircle : badge.icon === 'AlertCircle' ? AlertCircle : Clock;

  return (
    <span className={badge.className}>
      <IconComponent className="w-3 h-3 mr-1" />
      {badge.text}
    </span>
  );
}

/**
 * Render participants avatars
 */
function renderParticipants(
  participants: Array<{
    id: number;
    colleague?: { name: string } | null | undefined;
  }>
) {
  const maxShow = 4;
  const visibleParticipants = participants.slice(0, maxShow);
  const remainingCount = participants.length - maxShow;

  return (
    <div className="flex items-center space-x-1">
      {visibleParticipants.map((participant, index) => (
        <EnhancedAvatar
          key={participant.id}
          name={participant.colleague?.name || m.common_unknown()}
          size="sm"
          className={`h-6 w-6 border-2 border-white ${index > 0 ? '-ml-2' : ''}`}
        />
      ))}
      {remainingCount > 0 && (
        <div className="z-1 -ml-2 h-6 w-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-xs font-medium text-muted-foreground">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

/**
 * Lazy participants dropdown — content only renders when open.
 */
const ParticipantsMenu = memo(
  ({
    participants,
    unpaidParticipants,
    totalParticipants,
  }: {
    participants: Array<{
      id: number;
      colleague?: { name: string } | null | undefined;
    }>;
    unpaidParticipants: Array<{
      id: number;
      colleague?: { name: string } | null | undefined;
    }>;
    totalParticipants: number;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center space-x-2 cursor-pointer group">
            {renderParticipants(participants)}
            <span className="text-sm text-foreground">
              <Users className="-ml-0.5 w-3 h-3 inline mr-0.5 text-muted-foreground" />
              {totalParticipants}
            </span>
          </div>
        </DropdownMenuTrigger>
        {open && (
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem className="flex flex-col items-start px-2 py-1 cursor-default focus:bg-transparent hover:bg-transparent">
              <div className="flex items-center text-foreground font-semibold mb-1">
                {m.expense_participants_unpaid({ count: String(unpaidParticipants.length) })}
              </div>
              <div className="flex flex-wrap gap-1">
                {unpaidParticipants.map((p) => {
                  const bgColorClass = getInitialsColor(p.colleague?.name || m.common_unknown());
                  return (
                    <span key={p.id} className={`${bgColorClass} ${UNPAID_PILL_CLASS}`}>
                      {p.colleague?.name || m.common_unknown()}
                    </span>
                  );
                })}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }
);

/**
 * Lazy actions dropdown — content only renders when open,
 * cutting initial mount cost from N rows to zero.
 */
const ActionsMenu = memo(
  ({
    expense,
    isAdmin,
    onViewReceipt,
    onEdit,
    onDuplicate,
    onDelete,
  }: {
    expense: Expense;
    isAdmin: boolean;
    onViewReceipt?: ((expense: Expense) => void) | undefined;
    onEdit?: ((expense: Expense) => void) | undefined;
    onDuplicate?: ((expense: Expense) => void) | undefined;
    onDelete?: ((expense: Expense) => void) | undefined;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            data-testid={TABLE_COL.ROW_ACTIONS_BTN}
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        {open && (
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{m.expense_col_actions()}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/expense/$id/" params={{ id: expense.id.toString() }}>
                {m.expense_action_view()}
              </Link>
            </DropdownMenuItem>
            {expense.receiptBucket && expense.receiptObjectKey && (
              <DropdownMenuItem onClick={() => onViewReceipt?.(expense)}>
                {m.expense_action_viewReceipt()}
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onEdit?.(expense)}
                  className="cursor-pointer"
                  data-testid={EXPENSE.EDIT_EXPENSE_MENUITEM}
                >
                  {m.expense_action_edit()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDuplicate?.(expense)}
                  className="cursor-pointer"
                  data-testid={EXPENSE.DUPLICATE_EXPENSE_MENUITEM}
                >
                  {m.expense_action_duplicate()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(expense)}
                  className="text-destructive-text focus:text-destructive-text cursor-pointer"
                  data-testid={EXPENSE.DELETE_EXPENSE_MENUITEM}
                >
                  {m.expense_action_delete()}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }
);

/**
 * Desktop table row component
 */
const DesktopExpenseRow = memo(
  ({ expense, onViewReceipt, onEdit, onDuplicate, onDelete }: DesktopExpenseRowProps) => {
    const { isAdmin } = useAuth();
    const participants = expense.participants ?? [];
    const totalParticipants = participants.length;
    const unpaidParticipants = participants.filter((p) => !p.isPaid);
    const unpaidCount = unpaidParticipants.length;

    return (
      <TableRow
        key={expense.id}
        data-testid={EXPENSE.EXPENSE_TABLE_ROW}
        className="hover:bg-accent"
      >
        {/* Restaurant & Date */}
        <TableCell className="font-medium">
          <div className="space-y-2 py-1">
            <Link
              to="/expense/$id/"
              params={{ id: expense.id.toString() }}
              className="text-foreground hover:text-foreground font-semibold hover:underline block"
              data-testid={expenseDetailLinkId(expense.id)}
            >
              {expense.restaurant?.name || m.expense_detail_unknownRestaurant()}
            </Link>
            {expense.restaurant?.address && (
              <div className="flex items-center text-xs text-muted-foreground/80">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate max-w-[220px]">{expense.restaurant.address}</span>
              </div>
            )}
            <DateWithBadge
              dateString={
                typeof expense.date === 'string' ? expense.date : expense.date.toISOString()
              }
              className="text-xs"
            />
          </div>
        </TableCell>

        {/* Amount */}
        <TableCell>
          <div className="text-lg font-bold text-foreground">{formatCurrency(expense.amount)}</div>
        </TableCell>

        {/* Participants */}
        <TableCell>
          <div className="flex items-center space-x-2">
            {totalParticipants > 0 ? (
              unpaidCount > 0 ? (
                <ParticipantsMenu
                  participants={participants}
                  unpaidParticipants={unpaidParticipants}
                  totalParticipants={totalParticipants}
                />
              ) : (
                <div className="flex items-center space-x-2">
                  {renderParticipants(participants)}
                  <span className="text-sm text-foreground">
                    <Users className="-ml-0.5 w-3 h-3 inline mr-0.5 text-muted-foreground" />
                    {totalParticipants}
                  </span>
                </div>
              )
            ) : (
              <span className="text-sm text-muted-foreground">
                {m.expense_settlement_noParticipants()}
              </span>
            )}
          </div>
        </TableCell>

        {/* Payment Status */}
        <TableCell>{renderPaymentStatusBadge(expense)}</TableCell>

        {/* Details */}
        <TableCell>
          <div className="flex items-center space-x-2">
            {expense.receiptBucket && expense.receiptObjectKey && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewReceipt?.(expense)}
                className="h-7 w-7 p-0"
                title={m.expense_action_viewReceipt()}
                aria-label="View receipt"
                data-testid={EXPENSE.RECEIPT_BTN}
              >
                <Receipt className="h-3 w-3" />
              </Button>
            )}
            {expense.notes && (
              <div className="h-7 w-7 flex items-center justify-center" title={expense.notes}>
                <FileText className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <ActionsMenu
            expense={expense}
            isAdmin={isAdmin}
            onViewReceipt={onViewReceipt}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </TableCell>
      </TableRow>
    );
  }
);

/**
 * Expense list display component
 * Shows detailed table on desktop and mobile cards on smaller screens
 * Now with server-side pagination support
 */
export const ExpenseList = ({
  expenses,
  isLoading = false,
  onViewReceipt,
  onAddExpense,
  onPaymentClaim,
  onEdit,
  onDuplicate,
  onDelete,
  isProcessingClaim = {},
  pendingClaimsByColleague = {},
  showEmptyAddButton = true,
  emptyTitle,
  emptyDescription,
  pagination,
  onPaginationChange,
  onSearchChange,
  onSortChange: _onSortChange,
  colleagues = [],
  selectedColleagueIds = [],
  onColleagueChange,
  selectedPaymentStatus = 'all',
  onPaymentStatusChange,
  searchPlaceholder = m.expense_search_placeholder(),
  allowedPageSizes = [10, 20, 50, 100],
}: ExpenseListProps) => {
  const resolvedEmptyTitle = emptyTitle ?? m.expense_empty_noExpenses();
  const resolvedEmptyDescription = emptyDescription ?? m.expense_empty_getStarted();
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [search, setSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const lastFiredSearchRef = useRef<string>('');

  // Auto-search on typing (debounced) — onSearchChange drives a server refetch,
  // so the initial mount must not re-trigger it with an empty query. The
  // last-fired guard matters: parents recreate onSearchChange each render, so
  // without it every re-render (e.g. pagination change) would re-fire the
  // search and reset the list to page 1.
  useEffect(() => {
    if (!onSearchChange) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastFiredSearchRef.current = search;
      return;
    }

    if (search === lastFiredSearchRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = globalThis.setTimeout(() => {
      lastFiredSearchRef.current = search;
      onSearchChange(search);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    };
  }, [search, onSearchChange]);

  // Enter skips the debounce
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      lastFiredSearchRef.current = search;
      onSearchChange?.(search);
    }
  };

  // Handle colleague filter change
  const handleColleagueFilterChange = (colleagueId: string) => {
    if (colleagueId === 'all') {
      onColleagueChange?.([]);
    } else {
      const id = Number.parseInt(colleagueId, 10);
      onColleagueChange?.([id]);
    }
  };

  // Remove a colleague from filter
  const removeColleagueFilter = (colleagueId: number) => {
    onColleagueChange?.(selectedColleagueIds.filter((id) => id !== colleagueId));
  };

  const handlePaymentStatusChange = (status: string) => {
    switch (status) {
      case 'all':
      case 'paid':
      case 'unpaid':
      case 'partial':
        onPaymentStatusChange?.(status);
        break;
    }
  };

  const resultsRange = useMemo(() => {
    if (!pagination) return null;
    return {
      start: Math.min(
        expenses.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0,
        pagination.totalCount
      ),
      end: Math.min(pagination.page * pagination.pageSize, pagination.totalCount),
      total: pagination.totalCount,
    };
  }, [pagination, expenses.length]);

  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    if (!pagination) return [];

    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, pagination.page - delta);
      i <= Math.min(pagination.totalPages - 1, pagination.page + delta);
      i++
    ) {
      range.push(i);
    }

    if (pagination.page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (pagination.page + delta < pagination.totalPages - 1) {
      rangeWithDots.push('...', pagination.totalPages);
    } else if (pagination.totalPages > 1) {
      rangeWithDots.push(pagination.totalPages);
    }

    return rangeWithDots;
  }, [pagination]);

  // Main component structure with consistent header and controls
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.expense_title()}</CardTitle>
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mt-4">
          {/* Search */}
          {onSearchChange && (
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="pl-10 w-full"
                data-testid={EXPENSE.SEARCH_EXPENSES_INPUT}
              />
            </div>
          )}

          {/* Colleague Filter */}
          {onColleagueChange && colleagues.length > 0 && (
            <Select
              value={
                selectedColleagueIds.length > 0 && selectedColleagueIds[0] !== undefined
                  ? selectedColleagueIds[0].toString()
                  : 'all'
              }
              onValueChange={handleColleagueFilterChange}
            >
              <SelectTrigger aria-label="Colleague filter" className="w-[180px]">
                <SelectValue placeholder={m.expense_filter_allColleagues()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.expense_filter_allColleagues()}</SelectItem>
                {colleagues.map((colleague) => (
                  <SelectItem key={colleague.id} value={colleague.id.toString()}>
                    {colleague.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Payment Status Filter */}
          {onPaymentStatusChange && (
            <Select value={selectedPaymentStatus} onValueChange={handlePaymentStatusChange}>
              <SelectTrigger aria-label="Payment status" className="w-[180px]">
                <SelectValue placeholder={m.expense_filter_allStatus()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.expense_filter_allStatus()}</SelectItem>
                <SelectItem value="paid">{m.expense_status_paid()}</SelectItem>
                <SelectItem value="unpaid">{m.expense_status_unpaid()}</SelectItem>
                <SelectItem value="partial">{m.expense_status_partiallyPaid()}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Selected Colleague Chips */}
        {selectedColleagueIds.length > 0 && colleagues.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {selectedColleagueIds.map((colleagueId) => {
              const colleague = colleagues.find((c) => c.id === colleagueId);
              if (!colleague) return null;
              return (
                <Badge key={colleagueId} variant="secondary" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {colleague.name}
                  <button
                    type="button"
                    onClick={() => removeColleagueFilter(colleagueId)}
                    className="ml-1 hover:text-destructive-text focus:outline-none"
                    aria-label={`Remove ${colleague.name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Results count */}
        {resultsRange && (
          <p className="text-sm text-muted-foreground mb-4">
            {m.expense_results_showing({
              start: String(resultsRange.start),
              end: String(resultsRange.end),
              total: String(resultsRange.total),
            })}
          </p>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders with fixed count
              <div key={`skeleton-${i}`} className="animate-pulse">
                <div className="h-32 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && expenses.length === 0 && (
          <div className="text-center py-12">
            {showEmptyAddButton ? (
              <AdminOnly>
                <EmptyStateWithAction
                  title={resolvedEmptyTitle}
                  description={resolvedEmptyDescription}
                  actionText={m.expense_empty_addFirst()}
                  onAction={onAddExpense || (() => {})}
                />
              </AdminOnly>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">{resolvedEmptyTitle}</h3>
                <p className="text-muted-foreground">{resolvedEmptyDescription}</p>
              </div>
            )}
          </div>
        )}

        {/* Expense list content — always mounted when data exists, toggled via CSS to avoid unmount/remount */}
        {expenses.length > 0 && (
          <div className={isLoading ? 'hidden' : ''}>
            {/* Desktop Table View */}
            {!isMobile && (
              <Table data-testid={EXPENSE.EXPENSE_TABLE}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]" data-testid={RESTAURANT.RESTAURANT_COL}>
                      {m.expense_col_restaurantDate()}
                    </TableHead>
                    <TableHead className="w-[120px]" data-testid={EXPENSE.AMOUNT_COL}>
                      {m.expense_col_amount()}
                    </TableHead>
                    <TableHead className="w-[150px]" data-testid={TABLE_COL.PARTICIPANTS_COL}>
                      {m.expense_col_participants()}
                    </TableHead>
                    <TableHead className="w-[120px]" data-testid={EXPENSE.STATUS_COL}>
                      {m.expense_col_status()}
                    </TableHead>
                    <TableHead className="w-[100px]" data-testid={TABLE_COL.DETAILS_COL}>
                      {m.expense_col_details()}
                    </TableHead>
                    <TableHead className="w-[80px]" data-testid={TABLE_COL.ACTIONS_COL}>
                      {m.expense_col_actions()}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <DesktopExpenseRow
                      key={expense.id}
                      expense={expense}
                      onViewReceipt={onViewReceipt}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <div className="space-y-4" data-testid={EXPENSE.EXPENSE_MOBILE_LIST}>
                {expenses.map((expense) => (
                  <ExpenseMobileCard
                    key={expense.id}
                    expense={expense}
                    onReceiptClick={onViewReceipt ? () => onViewReceipt(expense) : undefined}
                    onPaymentClaim={onPaymentClaim}
                    pendingClaimsByColleague={pendingClaimsByColleague}
                    isProcessingClaim={isProcessingClaim}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls - Show when pagination is available and total count > 0 */}
        {pagination && onPaginationChange && pagination.totalCount > 0 && (
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mt-6 pt-6 border-t">
            {/* Page Size Selector */}
            <div className="flex items-center justify-center space-x-2 lg:justify-start">
              <p className="text-sm font-medium">{m.expense_pagination_rowsPerPage()}</p>
              <select
                value={pagination.pageSize}
                onChange={(e) => onPaginationChange(1, Number(e.target.value))}
                className="h-8 w-[70px] rounded border border-border text-sm"
                disabled={isLoading}
                aria-label={m.table_rowsPerPage()}
              >
                {allowedPageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-center lg:order-last lg:justify-end">
              <p className="text-sm text-muted-foreground text-center lg:text-right">
                {resultsRange &&
                  m.expense_results_showing({
                    start: String(resultsRange.start),
                    end: String(resultsRange.end),
                    total: String(resultsRange.total),
                  })}
              </p>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center justify-center space-x-1 lg:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPaginationChange(1, pagination.pageSize)}
                disabled={!pagination.hasPreviousPage || isLoading}
                className="hidden sm:flex"
                aria-label={m.table_first()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPaginationChange(pagination.page - 1, pagination.pageSize)}
                disabled={!pagination.hasPreviousPage || isLoading}
                aria-label={m.table_previous()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center space-x-1 max-w-full overflow-x-auto">
                <div className="flex items-center space-x-1 min-w-0">
                  {pageNumbers.map((pageNumber) => (
                    <Button
                      key={`page-${pageNumber}`}
                      variant={pageNumber === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={() =>
                        typeof pageNumber === 'number' &&
                        onPaginationChange(pageNumber, pagination.pageSize)
                      }
                      disabled={typeof pageNumber !== 'number' || isLoading}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPaginationChange(pagination.page + 1, pagination.pageSize)}
                disabled={!pagination.hasNextPage || isLoading}
                aria-label={m.table_next()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPaginationChange(pagination.totalPages, pagination.pageSize)}
                disabled={!pagination.hasNextPage || isLoading}
                className="hidden sm:flex"
                aria-label={m.table_last()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
