import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParticipationChart } from '../participation-chart';

vi.mock('@/paraglide/messages', () => ({
  m: {
    dashboard_teamParticipation: () => 'Team Participation',
    dashboard_overallParticipation: () => 'Overall Participation',
    dashboard_engagementLevel: () => 'Engagement Level',
    dashboard_engagementExcellent: () => 'Excellent',
    dashboard_engagementGood: () => 'Good',
    dashboard_engagementNeedsWork: () => 'Needs Work',
  },
}));

describe('ParticipationChart', () => {
  it('renders participation rate', () => {
    render(<ParticipationChart lunchParticipationRate={75} />);
    expect(screen.getByText('Team Participation')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(2);
  });

  it('shows excellent engagement for rate above 80', () => {
    render(<ParticipationChart lunchParticipationRate={85} />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows good engagement for rate above 60 and up to 80', () => {
    render(<ParticipationChart lunchParticipationRate={70} />);
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows needs work engagement for rate 60 or below', () => {
    render(<ParticipationChart lunchParticipationRate={45} />);
    expect(screen.getByText('Needs Work')).toBeInTheDocument();
  });

  it('handles zero participation rate', () => {
    render(<ParticipationChart lunchParticipationRate={0} />);
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Needs Work')).toBeInTheDocument();
  });

  it('handles 100% participation rate', () => {
    render(<ParticipationChart lunchParticipationRate={100} />);
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });
});
