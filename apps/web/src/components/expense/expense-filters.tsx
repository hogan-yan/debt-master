import { Filter, RotateCcw, Search, User, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { m } from '@/paraglide/messages';
import { EXPENSE } from '@/test/test-ids';

interface ColleagueOption {
  id: number;
  name: string;
}

interface ExpenseFiltersProps {
  /** Current search term */
  searchTerm: string;
  /** Current status filter */
  selectedStatus: 'all' | 'paid' | 'unpaid' | 'pending';
  /** Currently selected colleague IDs */
  selectedColleagueIds: number[];
  /** Available colleagues for filtering */
  availableColleagues: ColleagueOption[];
  /** Current sort field */
  sortBy: 'date' | 'amount' | 'restaurant';
  /** Current sort order */
  sortOrder: 'asc' | 'desc';
  /** Search term change handler */
  onSearchChange: (value: string) => void;
  /** Status filter change handler */
  onStatusChange: (value: 'all' | 'paid' | 'unpaid' | 'pending') => void;
  /** Colleague filter change handler */
  onColleagueChange: (colleagueIds: number[]) => void;
  /** Sort field change handler */
  onSortByChange: (value: 'date' | 'amount' | 'restaurant') => void;
  /** Sort order change handler */
  onSortOrderChange: (value: 'asc' | 'desc') => void;
  /** Reset filters handler */
  onResetFilters: () => void;
  /** Total results count */
  totalResults?: number;
  /** Whether filters are currently active */
  hasActiveFilters?: boolean;
}

/**
 * Expense filters and search component
 * Provides filtering, searching, and sorting capabilities for expense lists
 */
export const ExpenseFilters = ({
  searchTerm,
  selectedStatus,
  selectedColleagueIds,
  availableColleagues,
  sortBy,
  sortOrder,
  onSearchChange,
  onStatusChange,
  onColleagueChange,
  onSortByChange,
  onSortOrderChange,
  onResetFilters,
  totalResults,
  hasActiveFilters = false,
}: ExpenseFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedStatus !== 'all') count++;
    if (selectedColleagueIds.length > 0) count++;
    if (sortBy !== 'date' || sortOrder !== 'desc') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const removeColleague = (colleagueId: number) => {
    onColleagueChange(selectedColleagueIds.filter((id) => id !== colleagueId));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters & Search</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden"
          >
            {isExpanded ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className={`pt-0 ${isExpanded ? 'block' : 'hidden md:block'}`}>
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Expenses</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder={m.expense_search_placeholder()}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
                data-testid={EXPENSE.SEARCH_EXPENSES_INPUT}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSearchChange('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">{m.expense_col_status()}</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value: 'all' | 'paid' | 'unpaid' | 'pending') =>
                  onStatusChange(value)
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{m.expense_filter_allStatus()}</SelectItem>
                  <SelectItem value="paid">{m.expense_status_paid()}</SelectItem>
                  <SelectItem value="unpaid">{m.expense_status_unpaid()}</SelectItem>
                  <SelectItem value="pending">{m.expense_status_partiallyPaid()}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Colleague Filter */}
            <div className="space-y-2">
              <Label htmlFor="colleague">Colleague</Label>
              <Select
                value={
                  selectedColleagueIds.length > 0 && selectedColleagueIds[0] !== undefined
                    ? selectedColleagueIds[0].toString()
                    : 'all'
                }
                onValueChange={(value) => {
                  if (value === 'all') {
                    onColleagueChange([]);
                  } else {
                    onColleagueChange([Number.parseInt(value, 10)]);
                  }
                }}
              >
                <SelectTrigger id="colleague">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleagues</SelectItem>
                  {availableColleagues.map((colleague) => (
                    <SelectItem key={colleague.id} value={colleague.id.toString()}>
                      {colleague.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={sortBy}
                onValueChange={(value: 'date' | 'amount' | 'restaurant') => onSortByChange(value)}
              >
                <SelectTrigger id="sortBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Order</Label>
              <Select
                value={sortOrder}
                onValueChange={(value: 'asc' | 'desc') => onSortOrderChange(value)}
              >
                <SelectTrigger id="sortOrder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Colleagues Chips */}
          {selectedColleagueIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Filtered by:</span>
              {selectedColleagueIds.map((colleagueId) => {
                const colleague = availableColleagues.find((c) => c.id === colleagueId);
                if (!colleague) return null;
                return (
                  <Badge key={colleagueId} variant="secondary" className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {colleague.name}
                    <button
                      type="button"
                      onClick={() => removeColleague(colleagueId)}
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

          {/* Results Summary and Reset */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              {totalResults !== undefined && (
                <span>
                  {totalResults} expense{totalResults !== 1 ? 's' : ''} found
                  {hasActiveFilters && ' (filtered)'}
                </span>
              )}
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetFilters}
                className="flex items-center space-x-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Filters</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
