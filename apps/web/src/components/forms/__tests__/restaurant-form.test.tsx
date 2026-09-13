import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestaurantForm } from '../restaurant-form';

const mockOnSuccess = vi.hoisted(() => vi.fn());
const mockHandleSubmit = vi.hoisted(() =>
  vi.fn(async (fn: () => Promise<unknown>) => {
    await fn();
    mockOnSuccess();
  })
);

vi.mock('@/hooks', () => ({
  useFormSubmission: ({ onSuccess }: { onSuccess: () => void }) => {
    mockOnSuccess.mockImplementation(onSuccess);

    return {
      isSubmitting: false,
      handleSubmit: mockHandleSubmit,
      error: null,
      reset: vi.fn(),
    };
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    restaurant_form_updatedTitle: () => 'Updated',
    restaurant_form_addedTitle: () => 'Added',
    restaurant_form_updatedMessage: () => 'Update msg',
    restaurant_form_addedMessage: () => 'Add msg',
    restaurant_form_updateFailed: () => 'Update failed',
    restaurant_form_addFailed: () => 'Add failed',
    restaurant_toast_updated: () => 'Updated toast',
    restaurant_toast_added: () => 'Added toast',
    restaurant_form_placeholder_cuisine: () => 'Select cuisine',
  },
}));

vi.mock('@/lib/schemas', () => ({
  createRestaurantSchema: {
    shape: {
      name: {
        safeParse: (value: string) => ({
          success: value.length >= 1,
          error: { issues: [{ message: 'Name required' }] },
        }),
      },
      address: {
        safeParse: (value: string) => ({
          success: value.length >= 1,
          error: { issues: [{ message: 'Address required' }] },
        }),
      },
    },
  },
  getCuisineSelectOptions: () => [
    { value: 'italian', label: 'Italian' },
    { value: 'japanese', label: 'Japanese' },
  ],
}));

const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

describe('RestaurantForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add form with default values', () => {
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.getByLabelText(/restaurant name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
  });

  it('renders edit form with initial data', () => {
    render(
      <RestaurantForm
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{ name: 'Sushi Bar', address: '123 Main St' }}
      />
    );
    expect(screen.getByDisplayValue('Sushi Bar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('shows add button text when not editing', () => {
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.getByRole('button', { name: /add restaurant/i })).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/restaurant name/i), 'Bistro');
    await user.type(screen.getByLabelText(/address/i), '789 Oak St');
    await user.click(screen.getByRole('button', { name: /add restaurant/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bistro', address: '789 Oak St' })
      );
    });
  });

  it('closes after a successful submission', async () => {
    const user = userEvent.setup();
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/restaurant name/i), 'Bistro');
    await user.type(screen.getByLabelText(/address/i), '789 Oak St');
    await user.click(screen.getByRole('button', { name: /add restaurant/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  it('submits edit form with initial data', async () => {
    const user = userEvent.setup();
    render(
      <RestaurantForm
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{ name: 'Sushi Bar', address: '123 Main St' }}
      />
    );

    await user.clear(screen.getByLabelText(/restaurant name/i));
    await user.type(screen.getByLabelText(/restaurant name/i), 'New Name');
    await user.click(screen.getByRole('button', { name: /update restaurant/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name', address: '123 Main St' })
      );
    });
  });

  it('does not submit when required name is empty', async () => {
    const user = userEvent.setup();
    render(<RestaurantForm onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: /add restaurant/i }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
