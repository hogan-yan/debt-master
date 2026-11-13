import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '../page-header';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Overview" />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<PageHeader title="Dashboard" action={<button type="button">Action</button>} />);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PageHeader title="Test" className="custom-header" />);
    expect(container.firstChild).toHaveClass('custom-header');
  });

  it('applies data-testid', () => {
    render(<PageHeader title="Test" data-testid="page-header" />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });
});
