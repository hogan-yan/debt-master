/**
 * Tests for ExpenseForm itemized item inputs
 * Catches React key stability bugs that cause input blur on each keystroke
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseForm } from '../expense-form';

const mockColleagues = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const mockRestaurants = [{ id: 10, name: 'Pizza Place' }];

const defaultProps = {
  colleagues: mockColleagues,
  restaurants: mockRestaurants,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('ExpenseForm itemized inputs', () => {
  it('retains focus when typing in item price field', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    // Select a participant to reveal item rows
    const checkbox = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(checkbox);

    // Find the price input via placeholder
    const priceInput = screen.getByPlaceholderText('0.00');
    expect(priceInput).toBeInTheDocument();

    // Type multiple characters — if key is unstable, focus is lost after first char
    await user.type(priceInput, '25');

    expect(priceInput).toHaveFocus();
    // With a stable key, the value accumulates; with an unstable key it resets
    expect(priceInput).toHaveValue(25);
  });

  it('accumulates full value when typing item name', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(checkbox);

    const nameInput = screen.getByPlaceholderText('Item name (optional)');
    await user.type(nameInput, 'Burger');

    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveValue('Burger');
  });

  it('allows typing in price after typing in name', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(checkbox);

    const nameInput = screen.getByPlaceholderText('Item name (optional)');
    const priceInput = screen.getByPlaceholderText('0.00');

    await user.type(nameInput, 'Fries');
    await user.type(priceInput, '5.50');

    expect(nameInput).toHaveValue('Fries');
    expect(priceInput).toHaveValue(5.5);
  });

  it('updates per-person total when price changes', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Alice' });
    await user.click(checkbox);

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '12');

    expect(screen.getByText("Alice's Total:")).toBeInTheDocument();
    // The total display next to the label should show the entered amount
    const totalRow = screen.getByText("Alice's Total:").closest('.flex');
    expect(totalRow).toHaveTextContent('$12.00');
  });
});
