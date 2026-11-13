import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardTabs } from '../dashboard-tabs';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

describe('DashboardTabs', () => {
  it('renders all 4 tabs', () => {
    render(<DashboardTabs activeTab="overview" onTabChange={vi.fn()} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('marks active tab as selected', () => {
    render(<DashboardTabs activeTab="overview" onTabChange={vi.fn()} />);

    const overviewTab = screen.getByTestId('overview-tab');
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const debtorsTab = screen.getByTestId('who-owes-tab');
    expect(debtorsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabChange on click', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="overview" onTabChange={onTabChange} />);

    await user.click(screen.getByTestId('who-owes-tab'));
    expect(onTabChange).toHaveBeenCalledWith('debtors');
  });

  it('navigates right on ArrowRight key', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="overview" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('debtors');
  });

  it('navigates left on ArrowLeft key', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="debtors" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('wraps from last to first on ArrowRight', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="spending" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('wraps from first to last on ArrowLeft', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="overview" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('spending');
  });

  it('goes to first tab on Home key', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="spending" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('goes to last tab on End key', () => {
    const onTabChange = vi.fn();

    render(<DashboardTabs activeTab="overview" onTabChange={onTabChange} />);

    const tablist = screen.getByRole('tablist');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(onTabChange).toHaveBeenCalledWith('spending');
  });

  it('marks debtors tab as active', () => {
    render(<DashboardTabs activeTab="debtors" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('who-owes-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('overview-tab')).toHaveAttribute('aria-selected', 'false');
  });

  it('marks restaurants tab as active', () => {
    render(<DashboardTabs activeTab="restaurants" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('restaurants-tab')).toHaveAttribute('aria-selected', 'true');
  });

  it('marks spending tab as active', () => {
    render(<DashboardTabs activeTab="spending" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('spending-tab')).toHaveAttribute('aria-selected', 'true');
  });
});
