import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColleagueDetailTabs } from '../colleague-detail-tabs';

vi.mock('@/paraglide/messages', () => ({
  m: {
    colleague_detail_tabAria: () => 'Activity tabs',
    colleague_detail_tabActivity: () => 'Activity',
  },
}));

describe('ColleagueDetailTabs', () => {
  it('renders activity tab', () => {
    render(<ColleagueDetailTabs activeTab="activity" onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Activity');
  });

  it('calls onTabChange when tab clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<ColleagueDetailTabs activeTab="activity" onTabChange={onTabChange} />);
    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(onTabChange).toHaveBeenCalledWith('activity');
  });

  it('renders inactive tab styling when active tab does not match', () => {
    render(
      <ColleagueDetailTabs activeTab={'unknown' as unknown as 'activity'} onTabChange={vi.fn()} />
    );
    const tab = screen.getByRole('tab', { name: 'Activity' });
    expect(tab).toHaveAttribute('aria-selected', 'false');
  });
});
