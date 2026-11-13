/**
 * Tests for ColleagueForm component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLEAGUE, COLLEAGUE_FORM } from '@/test/test-ids';
import { ColleagueForm } from '../colleague-form';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const defaultProps = {
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('ColleagueForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name input, submit and cancel buttons in create mode', () => {
    render(<ColleagueForm {...defaultProps} />);

    // Name input
    expect(screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT)).toBeInTheDocument();

    // Cancel button
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Submit button (add mode)
    expect(screen.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN)).toBeInTheDocument();
  });

  it('shows validation error when name is empty after interaction', async () => {
    const user = userEvent.setup();
    render(<ColleagueForm {...defaultProps} />);

    // Type and then clear the name to trigger onChange validation
    const nameInput = screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT);
    await user.type(nameInput, 'A');
    await user.clear(nameInput);
    await user.tab();

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    // onSubmit should not have been called
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when name is too short', async () => {
    const user = userEvent.setup();
    render(<ColleagueForm {...defaultProps} />);

    const nameInput = screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT);
    await user.type(nameInput, 'A');
    await user.tab();

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters long')).toBeInTheDocument();
    });
  });

  it('calls onSubmit with valid data when form is submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ColleagueForm {...defaultProps} onSubmit={onSubmit} />);

    const nameInput = screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT);
    await user.type(nameInput, 'John Doe');

    const submitBtn = screen.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.name).toBe('John Doe');
  });

  it('pre-fills data in edit mode and shows update button', () => {
    const initialData = {
      name: 'Jane Smith',
    };

    render(<ColleagueForm {...defaultProps} initialData={initialData} />);

    // Name should be pre-filled
    expect(screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT)).toHaveValue('Jane Smith');

    // Should show update button (same testid, different text)
    const submitBtn = screen.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN);
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent(/update colleague/i);
  });

  it('submits an edited colleague', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ColleagueForm {...defaultProps} initialData={{ name: 'Jane Smith' }} onSubmit={onSubmit} />
    );

    await user.click(screen.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane Smith' });
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ColleagueForm {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose after successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ColleagueForm {...defaultProps} onClose={onClose} onSubmit={onSubmit} />);

    const nameInput = screen.getByTestId(COLLEAGUE_FORM.NAME_INPUT);
    await user.type(nameInput, 'Alice Cooper');

    const submitBtn = screen.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // onClose should be called via useFormSubmission onSuccess
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe('toastMessageForColleague', () => {
  it('returns add and update toast messages', async () => {
    const { toastMessageForColleague } = await import('../colleague-form');
    expect(toastMessageForColleague(false, 'Ada')).toContain('Ada');
    expect(toastMessageForColleague(true, 'Ada')).toContain('Ada');
  });
});
