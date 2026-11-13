import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColleagueDetailTabs } from './colleague-detail-tabs';

describe('ColleagueDetailTabs', () => {
  it('renders only the Activity tab', () => {
    render(<ColleagueDetailTabs activeTab="activity" onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /trend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /breakdown/i })).not.toBeInTheDocument();
  });

  it('marks the Activity tab as selected', () => {
    render(<ColleagueDetailTabs activeTab="activity" onTabChange={vi.fn()} />);
    const activityTab = screen.getByRole('tab', { name: /activity/i });
    expect(activityTab).toHaveAttribute('aria-selected', 'true');
  });

  it('has proper tab ARIA roles', () => {
    render(<ColleagueDetailTabs activeTab="activity" onTabChange={vi.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
  });
});
