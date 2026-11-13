import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';

const defaultProps = {
  isOpen: true,
  onOpenChange: vi.fn(),
  message: <p>Are you sure?</p>,
  onConfirm: vi.fn(),
};

describe('DeleteConfirmationDialog', () => {
  it('renders dialog content when isOpen is true', () => {
    render(<DeleteConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('does not render dialog when isOpen is false', () => {
    render(<DeleteConfirmationDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('displays custom title when provided', () => {
    render(<DeleteConfirmationDialog {...defaultProps} title="Remove Item" />);
    expect(screen.getByText('Remove Item')).toBeInTheDocument();
  });

  it('displays custom confirm and cancel text', () => {
    render(
      <DeleteConfirmationDialog {...defaultProps} confirmText="Remove" cancelText="Go Back" />
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmationDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmationDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onCancel when provided', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<DeleteConfirmationDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables buttons when isLoading is true', () => {
    render(<DeleteConfirmationDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
