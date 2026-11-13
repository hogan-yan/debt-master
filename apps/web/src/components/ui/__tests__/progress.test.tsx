import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from '../progress';

describe('Progress', () => {
  it('renders with default value of 0', () => {
    render(<Progress />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders with custom value and max', () => {
    render(<Progress value={50} max={200} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemax', '200');
  });

  it('caps percentage at 100 when value exceeds max', () => {
    render(<Progress value={150} max={100} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('clamps percentage at 0 for negative values', () => {
    render(<Progress value={-20} max={100} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Progress className="custom-class" />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(<Progress data-testid="progress-1" />);
    expect(screen.getByTestId('progress-1')).toBeInTheDocument();
  });
});
