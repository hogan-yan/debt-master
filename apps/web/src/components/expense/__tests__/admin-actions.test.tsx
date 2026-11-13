import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminActions } from '../admin-actions';

vi.mock('@/utils/auth-context', () => ({
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_detail_adminActions: () => 'Admin Actions',
    expense_detail_editExpense: () => 'Edit',
    expense_detail_duplicateExpense: () => 'Duplicate',
    expense_detail_deleteExpense: () => 'Delete',
  },
}));

describe('AdminActions', () => {
  it('renders all action buttons when all handlers provided', () => {
    render(
      <AdminActions expenseId={1} onEdit={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} />
    );
    expect(screen.getByText('Admin Actions')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides edit button when onEdit not provided', () => {
    render(<AdminActions expenseId={1} onDelete={vi.fn()} onDuplicate={vi.fn()} />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('hides delete button when onDelete not provided', () => {
    render(<AdminActions expenseId={1} onEdit={vi.fn()} onDuplicate={vi.fn()} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('hides duplicate button when onDuplicate not provided', () => {
    render(<AdminActions expenseId={1} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<AdminActions expenseId={1} onEdit={onEdit} />);
    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<AdminActions expenseId={1} onDelete={onDelete} />);
    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onDuplicate when duplicate button clicked', async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(<AdminActions expenseId={1} onDuplicate={onDuplicate} />);
    await user.click(screen.getByText('Duplicate'));
    expect(onDuplicate).toHaveBeenCalledOnce();
  });
});
