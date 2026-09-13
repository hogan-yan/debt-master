import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemizedSplitSection } from '../itemized-split-section';
import type { PersonItems } from '../use-person-items';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

const mockTogglePerson = vi.fn();
const mockAddItem = vi.fn();
const mockRemoveItem = vi.fn();
const mockUpdateItem = vi.fn();

const baseColleagues = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const baseProps = {
  colleagues: baseColleagues,
  personItems: [],
  togglePerson: mockTogglePerson,
  addItem: mockAddItem,
  removeItem: mockRemoveItem,
  updateItem: mockUpdateItem,
};

function StatefulSection() {
  const [personItems, setPersonItems] = useState<PersonItems[]>([
    { colleagueId: 1, items: [{ id: 'item-1', name: '', price: 0 }] },
  ]);

  return (
    <ItemizedSplitSection
      {...baseProps}
      personItems={personItems}
      updateItem={(personIndex, itemIndex, field, value) => {
        setPersonItems((prev) => {
          const next = [...prev];
          const person = { ...next[personIndex]! };
          const items = [...person.items];
          const nextValue = field === 'price' ? (value === '' ? 0 : Number(value)) : value;
          items[itemIndex] = { ...items[itemIndex]!, [field]: nextValue };
          person.items = items;
          next[personIndex] = person;
          return next;
        });
      }}
    />
  );
}

describe('ItemizedSplitSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders participant checkboxes', () => {
    render(<ItemizedSplitSection {...baseProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls togglePerson when checkbox changes', async () => {
    const user = userEvent.setup();
    render(<ItemizedSplitSection {...baseProps} />);
    const checkbox = screen.getByTestId('participant-checkbox-1');
    await user.click(checkbox);
    expect(mockTogglePerson).toHaveBeenCalledWith(1);
  });

  it('renders item rows and totals when personItems are provided', () => {
    render(
      <ItemizedSplitSection
        {...baseProps}
        personItems={[
          {
            colleagueId: 1,
            items: [
              { id: 'item-1', name: 'Burger', price: 12.5 },
              { id: 'item-2', name: 'Fries', price: 4 },
            ],
          },
        ]}
      />
    );

    expect(screen.getByDisplayValue('Burger')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12.5')).toBeInTheDocument();
    expect(screen.getByText('expense_form_personTotal-{"name":"Alice"}')).toBeInTheDocument();
    expect(screen.getByText('expense_form_grandTotal')).toBeInTheDocument();
  });

  it('calls addItem when add button clicked', async () => {
    const user = userEvent.setup();
    render(
      <ItemizedSplitSection
        {...baseProps}
        personItems={[{ colleagueId: 1, items: [{ id: 'item-1', name: '', price: 0 }] }]}
      />
    );

    await user.click(screen.getByTestId('add-item-btn'));
    expect(mockAddItem).toHaveBeenCalledWith(0);
  });

  it('calls removeItem when remove button clicked', async () => {
    const user = userEvent.setup();
    render(
      <ItemizedSplitSection
        {...baseProps}
        personItems={[
          {
            colleagueId: 1,
            items: [
              { id: 'item-1', name: '', price: 0 },
              { id: 'item-2', name: '', price: 0 },
            ],
          },
        ]}
      />
    );

    const buttons = screen.getAllByLabelText('expense_form_deleteItem');
    await user.click(buttons[1]!);
    expect(mockRemoveItem).toHaveBeenCalledWith(0, 1);
  });

  it('disables remove button when only one item remains', () => {
    render(
      <ItemizedSplitSection
        {...baseProps}
        personItems={[{ colleagueId: 1, items: [{ id: 'item-1', name: '', price: 0 }] }]}
      />
    );

    expect(screen.getByLabelText('expense_form_deleteItem')).toBeDisabled();
  });

  it('calls updateItem when inputs change', async () => {
    const user = userEvent.setup();
    render(<StatefulSection />);

    const nameInput = screen.getByTestId('item-name-input');
    await user.type(nameInput, 'Salad');
    expect(nameInput).toHaveValue('Salad');

    const priceInput = screen.getByTestId('item-price-input');
    await user.clear(priceInput);
    await user.type(priceInput, '8.5');
    expect(priceInput).toHaveValue(8.5);
  });

  it('falls back to empty name for unknown colleague', () => {
    render(
      <ItemizedSplitSection
        {...baseProps}
        personItems={[{ colleagueId: 99, items: [{ id: 'item-1', name: '', price: 0 }] }]}
      />
    );

    expect(screen.getByText('expense_form_personTotal-{"name":""}')).toBeInTheDocument();
  });
});
