import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLLEAGUE_DETAIL } from '@/test/test-ids';
import { KpiStrip, type KpiStripProps } from './kpi-strip';

const defaultProps: KpiStripProps = {
  currentBalance: -50,
  totalOwed: 100,
  totalPaid: 50,
  debtAgeDays: 15,
  lastActivityDate: new Date(),
};

describe('KpiStrip', () => {
  it('renders 4 metrics in a single row', () => {
    render(<KpiStrip {...defaultProps} />);
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
    expect(screen.getByText('Debt Age')).toBeInTheDocument();
    expect(screen.getByText('Last Activity')).toBeInTheDocument();
    expect(screen.getByText('Payment Ratio')).toBeInTheDocument();
  });

  it('does not render Total Owed or Total Paid', () => {
    render(<KpiStrip {...defaultProps} />);
    expect(screen.queryByText('Total Owed')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Paid')).not.toBeInTheDocument();
  });

  it('shows debt age in days', () => {
    render(<KpiStrip {...defaultProps} debtAgeDays={15} />);
    expect(screen.getByText('15 days')).toBeInTheDocument();
  });

  it('shows N/A for debt age when null', () => {
    render(<KpiStrip {...defaultProps} debtAgeDays={null} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows relative date for last activity', () => {
    render(<KpiStrip {...defaultProps} lastActivityDate={new Date()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows No activity when lastActivityDate is null', () => {
    render(<KpiStrip {...defaultProps} lastActivityDate={null} />);
    expect(screen.getByText('No activity')).toBeInTheDocument();
  });

  it('shows Payment Ratio as percentage', () => {
    render(<KpiStrip {...defaultProps} totalOwed={100} totalPaid={50} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows N/A for Payment Ratio when totalOwed is 0', () => {
    render(<KpiStrip {...defaultProps} totalOwed={0} totalPaid={0} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows 100% for Payment Ratio when fully paid', () => {
    render(<KpiStrip {...defaultProps} totalOwed={100} totalPaid={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows positive balance icon and description', () => {
    render(<KpiStrip {...defaultProps} currentBalance={25} />);
    expect(screen.getByText(/Credit balance/i)).toBeInTheDocument();
    expect(screen.getByTestId(COLLEAGUE_DETAIL.NET_BALANCE_KPI)).toBeInTheDocument();
  });

  it('shows zero balance icon and description', () => {
    render(<KpiStrip {...defaultProps} currentBalance={0} />);
    expect(screen.getByText(/Balanced/i)).toBeInTheDocument();
  });

  it('uses different icons for Debt Age and Last Activity', () => {
    render(<KpiStrip {...defaultProps} />);
    const debtAgeIcon = screen.getByLabelText('Debt age');
    const lastActivityIcon = screen.getByLabelText('Last activity');
    expect(debtAgeIcon).toBeInTheDocument();
    expect(lastActivityIcon).toBeInTheDocument();
    expect(debtAgeIcon).not.toEqual(lastActivityIcon);
  });

  it('renders single-row grid with 4 equal columns on md breakpoint', () => {
    const { container } = render(<KpiStrip {...defaultProps} />);
    const grid = container.firstElementChild;
    expect(grid?.className).toMatch(/md:grid-cols-4/);
  });

  it('renders all cards with equal width (no col-span)', () => {
    const { container } = render(<KpiStrip {...defaultProps} />);
    const grid = container.firstElementChild;
    const cards = Array.from(grid?.children ?? []);
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.className).not.toMatch(/col-span/);
    }
  });
});
