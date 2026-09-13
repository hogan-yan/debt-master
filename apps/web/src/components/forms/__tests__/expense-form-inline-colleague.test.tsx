/**
 * Tests for inline colleague creation inside the expense form.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createColleague } from '@/server/colleagues/handlers';
import { EXPENSE_FORM, participantCheckboxId } from '@/test/test-ids';
import { ExpenseForm } from '../expense-form';

vi.mock('@/server/colleagues/handlers', () => ({
  createColleague: vi.fn(),
}));

const mockRestaurants = [{ id: 10, name: 'Pizza Place' }];
const defaultProps = {
  colleagues: [] as { id: number; name: string }[],
  restaurants: mockRestaurants,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('ExpenseForm inline colleague creation', () => {
  it('shows inline creator when no colleagues exist in ITEMIZED mode', () => {
    render(<ExpenseForm {...defaultProps} />);

    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN)).toBeInTheDocument();
    expect(screen.queryByTestId(participantCheckboxId(1))).not.toBeInTheDocument();
  });

  it('shows inline creator when no colleagues exist in EQUAL mode', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN)).toBeInTheDocument();
    expect(screen.queryByTestId(participantCheckboxId(1))).not.toBeInTheDocument();
  });

  it('hides inline creator when colleagues exist', () => {
    render(<ExpenseForm {...defaultProps} colleagues={[{ id: 1, name: 'Alice' }]} />);

    expect(screen.queryByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT)).not.toBeInTheDocument();
    expect(screen.getByTestId(participantCheckboxId(1))).toBeInTheDocument();
  });

  it('disables add button until name has at least 2 characters', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    const button = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN);

    expect(button).toBeDisabled();

    await user.type(input, 'A');
    expect(button).toBeDisabled();

    await user.type(input, 'B');
    expect(button).toBeEnabled();
  });

  it('creates and auto-selects colleague in EQUAL mode', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockResolvedValueOnce({ id: 99, name: 'Dana' });

    render(<ExpenseForm {...defaultProps} />);
    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Dana');
    await user.click(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN));

    await waitFor(() => {
      expect(createColleague).toHaveBeenCalledWith({ data: { name: 'Dana' } });
    });

    expect(screen.getByTestId(participantCheckboxId(99))).toBeChecked();
  });

  it('creates and auto-selects colleague in ITEMIZED mode', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockResolvedValueOnce({ id: 99, name: 'Dana' });

    render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Dana');
    await user.click(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN));

    await waitFor(() => {
      expect(createColleague).toHaveBeenCalledWith({ data: { name: 'Dana' } });
    });

    expect(screen.getByTestId(participantCheckboxId(99))).toBeChecked();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('shows inline error and does not add checkbox when creation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockRejectedValueOnce(new Error('Server error'));

    render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Dana');
    await user.click(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN));

    await waitFor(() => {
      expect(screen.getByText('Failed to add colleague. Please try again.')).toBeInTheDocument();
    });

    expect(screen.queryByTestId(participantCheckboxId(99))).not.toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN)).toBeEnabled();
  });

  it('discards locally added colleagues on unmount', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockResolvedValueOnce({ id: 99, name: 'Dana' });

    const { unmount } = render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Dana');
    await user.click(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(participantCheckboxId(99))).toBeInTheDocument();
    });

    unmount();
    render(<ExpenseForm {...defaultProps} />);

    expect(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.queryByTestId(participantCheckboxId(99))).not.toBeInTheDocument();
  });

  it('creates colleague when pressing Enter in the inline input', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockResolvedValueOnce({ id: 77, name: 'Eve' });

    render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Eve');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(createColleague).toHaveBeenCalledWith({ data: { name: 'Eve' } });
    });

    expect(screen.getByTestId(participantCheckboxId(77))).toBeInTheDocument();
  });

  it('does not call createColleague when pressing Enter with an empty name', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockClear();

    render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await input.focus();
    await user.keyboard('{Enter}');

    expect(createColleague).not.toHaveBeenCalled();
  });

  it('merges newly created colleague with existing colleagues after prop update', async () => {
    const user = userEvent.setup();
    vi.mocked(createColleague).mockResolvedValueOnce({ id: 99, name: 'Dana' });

    const { rerender } = render(<ExpenseForm {...defaultProps} />);

    const input = screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_NAME_INPUT);
    await user.type(input, 'Dana');
    await user.click(screen.getByTestId(EXPENSE_FORM.INLINE_COLLEAGUE_ADD_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(participantCheckboxId(99))).toBeInTheDocument();
    });

    rerender(
      <ExpenseForm
        {...defaultProps}
        colleagues={[
          { id: 1, name: 'Alice' },
          { id: 99, name: 'Dana' },
        ]}
      />
    );

    expect(screen.getByTestId(participantCheckboxId(1))).toBeInTheDocument();
    expect(screen.getByTestId(participantCheckboxId(99))).toBeInTheDocument();
  });
});
