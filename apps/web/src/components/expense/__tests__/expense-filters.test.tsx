import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseFilters } from '../expense-filters';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

vi.mock('@/paraglide/runtime', () => ({
  getLocale: () => 'en',
}));

vi.mock('@/components/ui/select', () => {
  const React = require('react');

  const MockSelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  );

  const MockSelectTrigger = () => null;

  const MockSelectContent = () => null;

  const MockSelect = ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    let selectId: string | undefined;

    const findId = (nodes: React.ReactNode) => {
      React.Children.forEach(nodes, (c: unknown) => {
        const child = c as React.ReactElement<{ id?: string; children?: React.ReactNode }>;
        if (React.isValidElement(child) && child.type === MockSelectTrigger) {
          selectId = child.props.id;
        }
      });
    };
    findId(children);

    const extractItems = (nodes: React.ReactNode): React.ReactNode[] => {
      const items: React.ReactNode[] = [];
      React.Children.forEach(nodes, (c: unknown) => {
        const child = c as React.ReactElement<{ children?: React.ReactNode }>;
        if (!React.isValidElement(child)) return;
        if (child.type === MockSelectItem) {
          items.push(child);
        } else if (child.props.children) {
          items.push(...extractItems(child.props.children));
        }
      });
      return items;
    };

    const items = extractItems(children);

    return (
      <select id={selectId} value={value} onChange={(e) => onValueChange(e.target.value)}>
        {items}
      </select>
    );
  };

  return {
    Select: MockSelect,
    SelectContent: MockSelectContent,
    SelectItem: MockSelectItem,
    SelectTrigger: MockSelectTrigger,
    SelectValue: () => null,
  };
});

describe('ExpenseFilters', () => {
  const defaultProps = {
    searchTerm: '',
    selectedStatus: 'all' as const,
    selectedColleagueIds: [] as number[],
    availableColleagues: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ],
    sortBy: 'date' as const,
    sortOrder: 'desc' as const,
    onSearchChange: vi.fn(),
    onStatusChange: vi.fn(),
    onColleagueChange: vi.fn(),
    onSortByChange: vi.fn(),
    onSortOrderChange: vi.fn(),
    onResetFilters: vi.fn(),
    totalResults: undefined,
    hasActiveFilters: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
  });

  it('renders status filter select', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('renders colleague filter select', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.getByLabelText(/colleague/i)).toBeInTheDocument();
  });

  it('renders sort by select', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it('renders sort order select', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.getByLabelText(/order/i)).toBeInTheDocument();
  });

  it('displays active filter count badge when filters are active', () => {
    render(<ExpenseFilters {...defaultProps} searchTerm="lunch" selectedStatus="paid" />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not display badge when no filters are active', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search input', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByLabelText(/search/i);
    await user.type(input, 'hi');

    expect(onSearchChange).toHaveBeenCalledWith('h');
    expect(onSearchChange).toHaveBeenCalledWith('i');
  });

  it('calls onSearchChange with empty string when clear button clicked', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} searchTerm="lunch" onSearchChange={onSearchChange} />);

    const clearBtn = screen
      .getByTestId('search-expenses-input')
      .parentElement?.querySelector('button');
    expect(clearBtn).toBeInTheDocument();
    if (clearBtn) {
      await user.click(clearBtn);
      expect(onSearchChange).toHaveBeenCalledWith('');
    }
  });

  it('does not show clear button when search term is empty', () => {
    render(<ExpenseFilters {...defaultProps} searchTerm="" />);
    const inputWrapper = screen.getByTestId('search-expenses-input').parentElement;
    const buttons = inputWrapper?.querySelectorAll('button');
    expect(buttons?.length ?? 0).toBe(0);
  });

  it('calls onStatusChange when status selection changes', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} onStatusChange={onStatusChange} />);

    const statusSelect = screen.getByLabelText(/status/i);
    expect(statusSelect).toBeInTheDocument();
    await user.selectOptions(statusSelect, 'paid');
    expect(onStatusChange).toHaveBeenCalledWith('paid');
  });

  it('calls onColleagueChange with colleague id when colleague selected', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} onColleagueChange={onColleagueChange} />);

    const colleagueSelect = screen.getByLabelText(/colleague/i);
    expect(colleagueSelect).toBeInTheDocument();
    await user.selectOptions(colleagueSelect, '1');
    expect(onColleagueChange).toHaveBeenCalledWith([1]);
  });

  it('calls onColleagueChange with empty array when all colleagues selected', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();
    render(
      <ExpenseFilters
        {...defaultProps}
        selectedColleagueIds={[1]}
        onColleagueChange={onColleagueChange}
      />
    );

    const colleagueSelect = screen.getByLabelText(/colleague/i);
    expect(colleagueSelect).toBeInTheDocument();
    await user.selectOptions(colleagueSelect, 'all');
    expect(onColleagueChange).toHaveBeenCalledWith([]);
  });

  it('calls onSortByChange when sort field changes', async () => {
    const user = userEvent.setup();
    const onSortByChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} onSortByChange={onSortByChange} />);

    const sortBySelect = screen.getByLabelText(/sort by/i);
    expect(sortBySelect).toBeInTheDocument();
    await user.selectOptions(sortBySelect, 'amount');
    expect(onSortByChange).toHaveBeenCalledWith('amount');
  });

  it('calls onSortOrderChange when sort order changes', async () => {
    const user = userEvent.setup();
    const onSortOrderChange = vi.fn();
    render(<ExpenseFilters {...defaultProps} onSortOrderChange={onSortOrderChange} />);

    const sortOrderSelect = screen.getByLabelText(/order/i);
    expect(sortOrderSelect).toBeInTheDocument();
    await user.selectOptions(sortOrderSelect, 'asc');
    expect(onSortOrderChange).toHaveBeenCalledWith('asc');
  });

  it('displays selected colleague chips and allows removal', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();
    render(
      <ExpenseFilters
        {...defaultProps}
        selectedColleagueIds={[1, 2]}
        onColleagueChange={onColleagueChange}
      />
    );

    const filteredBySection = screen.getByText(/filtered by:/i).parentElement;
    expect(filteredBySection).toBeInTheDocument();
    expect(filteredBySection?.textContent).toContain('Alice');
    expect(filteredBySection?.textContent).toContain('Bob');

    const removeAliceBtn = screen.getByRole('button', { name: /remove alice filter/i });
    await user.click(removeAliceBtn);

    expect(onColleagueChange).toHaveBeenCalledWith([2]);
  });

  it('does not display colleague chips when no colleagues selected', () => {
    render(<ExpenseFilters {...defaultProps} selectedColleagueIds={[]} />);
    expect(screen.queryByText(/filtered by:/i)).not.toBeInTheDocument();
  });

  it('shows results count when totalResults is provided', () => {
    render(<ExpenseFilters {...defaultProps} totalResults={5} hasActiveFilters />);
    expect(screen.getByText('5 expenses found (filtered)')).toBeInTheDocument();
  });

  it('shows singular result text when totalResults is 1', () => {
    render(<ExpenseFilters {...defaultProps} totalResults={1} />);
    expect(screen.getByText('1 expense found')).toBeInTheDocument();
  });

  it('shows reset filters button when filters are active', () => {
    render(<ExpenseFilters {...defaultProps} searchTerm="test" />);
    expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
  });

  it('does not show reset filters button when no filters are active', () => {
    render(<ExpenseFilters {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
  });

  it('calls onResetFilters when reset button clicked', async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();
    render(
      <ExpenseFilters
        {...defaultProps}
        searchTerm="test"
        selectedStatus="paid"
        onResetFilters={onResetFilters}
      />
    );

    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    await user.click(resetBtn);

    expect(onResetFilters).toHaveBeenCalledOnce();
  });

  it('counts sort deviation as active filter', () => {
    render(<ExpenseFilters {...defaultProps} sortBy="amount" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('counts sort order deviation as active filter', () => {
    render(<ExpenseFilters {...defaultProps} sortOrder="asc" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('does not count default sort as active filter', () => {
    render(<ExpenseFilters {...defaultProps} sortBy="date" sortOrder="desc" />);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('expands and collapses the mobile filter controls', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExpenseFilters {...defaultProps} />);
    const content = container.querySelector('.hidden.md\\:block');
    expect(content).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '' }));

    expect(content).toHaveClass('block');
  });

  it('omits chips for selected colleagues no longer available', () => {
    render(<ExpenseFilters {...defaultProps} selectedColleagueIds={[999]} />);

    expect(screen.queryByText('Filtered by:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});
