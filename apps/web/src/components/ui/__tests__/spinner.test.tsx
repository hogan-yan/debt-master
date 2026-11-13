import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from '../spinner';

describe('Spinner', () => {
  it('renders with default size', () => {
    render(<Spinner data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders with sm size', () => {
    render(<Spinner size="sm" data-testid="spinner-sm" />);
    expect(screen.getByTestId('spinner-sm')).toBeInTheDocument();
  });

  it('renders with lg size', () => {
    render(<Spinner size="lg" data-testid="spinner-lg" />);
    expect(screen.getByTestId('spinner-lg')).toBeInTheDocument();
  });

  it('renders with xl size', () => {
    render(<Spinner size="xl" data-testid="spinner-xl" />);
    expect(screen.getByTestId('spinner-xl')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Spinner className="custom-spinner" data-testid="spinner-custom" />);
    expect(screen.getByTestId('spinner-custom')).toHaveClass('custom-spinner');
  });
});
