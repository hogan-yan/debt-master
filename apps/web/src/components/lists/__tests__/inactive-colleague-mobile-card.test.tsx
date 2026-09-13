import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InactiveColleagueMobileCard } from '../inactive-colleague-mobile-card';

vi.mock('@/paraglide/messages', () => ({
  m: {
    colleague_badge_inactive: () => 'Inactive',
    colleague_col_deactivatedOn: () => 'Deactivated',
    colleague_actions_openMenu: () => 'Open menu',
    colleague_actions_label: () => 'Actions',
    colleague_actions_restore: () => 'Restore',
    colleague_actions_deletePermanent: () => 'Delete Permanently',
  },
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  formatDate: (_date: Date) => '2024-01-15',
  getBalanceColor: () => 'text-red-600',
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <span data-testid="avatar">{name[0]}</span>,
}));

const mockColleague = {
  id: 1,
  name: 'Alice Smith',
  currentBalance: -100,
  deletedAt: new Date('2024-01-01'),
  deletedBy: null,
};

describe('InactiveColleagueMobileCard', () => {
  it('renders colleague name with inactive badge', () => {
    render(
      <InactiveColleagueMobileCard
        colleague={mockColleague}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders formatted balance', () => {
    render(
      <InactiveColleagueMobileCard
        colleague={mockColleague}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    );
    expect(screen.getByText('$-100.00')).toBeInTheDocument();
  });

  it('renders deactivated date when available', () => {
    render(
      <InactiveColleagueMobileCard
        colleague={mockColleague}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    );
    expect(screen.getByText(/Deactivated/)).toBeInTheDocument();
  });

  it('calls onRestore when restore action clicked', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <InactiveColleagueMobileCard
        colleague={mockColleague}
        onRestore={onRestore}
        onPermanentDelete={vi.fn()}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);
    await user.click(screen.getByText('Restore'));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('calls onPermanentDelete when delete action clicked', async () => {
    const user = userEvent.setup();
    const onPermanentDelete = vi.fn();
    render(
      <InactiveColleagueMobileCard
        colleague={mockColleague}
        onRestore={vi.fn()}
        onPermanentDelete={onPermanentDelete}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);
    await user.click(screen.getByText('Delete Permanently'));
    expect(onPermanentDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('does not render deactivated date when deletedAt is null', () => {
    render(
      <InactiveColleagueMobileCard
        colleague={{ ...mockColleague, deletedAt: null, deletedBy: null }}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    );
    expect(screen.queryByText(/Deactivated/)).not.toBeInTheDocument();
  });
});
