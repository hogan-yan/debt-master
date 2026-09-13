import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ColleagueWithBalance } from '@/types';
import { ColleagueMobileCard } from '../colleague-mobile-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}/`, `${v}/`);
      }
    }
    return <a href={href}>{children}</a>;
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

function createColleague(overrides?: Partial<ColleagueWithBalance>): ColleagueWithBalance {
  return {
    id: 1,
    name: 'Alice Smith',
    currentBalance: -50,
    lastActivity: '2 days ago',
    ...overrides,
  };
}

describe('ColleagueMobileCard', () => {
  it('renders colleague name and balance', () => {
    render(
      <ColleagueMobileCard colleague={createColleague()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('-$50.00')).toBeInTheDocument();
  });

  it('shows balance status', () => {
    render(
      <ColleagueMobileCard colleague={createColleague()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.getByText('colleague_status_owes')).toBeInTheDocument();
  });

  it('shows credit status for positive balance', () => {
    render(
      <ColleagueMobileCard
        colleague={createColleague({ currentBalance: 50 })}
        isAdmin={false}
        onAction={() => {}}
      />
    );
    expect(screen.getByText('colleague_status_credit')).toBeInTheDocument();
  });

  it('shows even status for zero balance', () => {
    render(
      <ColleagueMobileCard
        colleague={createColleague({ currentBalance: 0 })}
        isAdmin={false}
        onAction={() => {}}
      />
    );
    expect(screen.getByText('colleague_status_balanced')).toBeInTheDocument();
  });

  it('shows admin dropdown when admin', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<ColleagueMobileCard colleague={createColleague()} isAdmin onAction={onAction} />);

    await user.click(screen.getByLabelText('colleague_actions_openMenu'));
    await user.click(screen.getByText('colleague_actions_edit'));
    expect(onAction).toHaveBeenCalledWith('edit', expect.objectContaining({ id: 1 }));
  });

  it('calls deactivate action', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<ColleagueMobileCard colleague={createColleague()} isAdmin onAction={onAction} />);

    await user.click(screen.getByLabelText('colleague_actions_openMenu'));
    await user.click(screen.getByText('colleague_actions_deactivate'));
    expect(onAction).toHaveBeenCalledWith('delete', expect.objectContaining({ id: 1 }));
  });

  it('hides dropdown when not admin', () => {
    render(
      <ColleagueMobileCard colleague={createColleague()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.queryByLabelText('colleague_actions_openMenu')).not.toBeInTheDocument();
  });

  it('links to colleague detail page', () => {
    render(
      <ColleagueMobileCard colleague={createColleague()} isAdmin={false} onAction={() => {}} />
    );
    const link = screen.getByText('Alice Smith').closest('a');
    expect(link).toHaveAttribute('href');
    expect(link?.getAttribute('href')).toContain('1');
  });
});
