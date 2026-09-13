import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColleagueHeaderBar, type ColleagueHeaderBarProps } from '../colleague-header-bar';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

const defaultProps: ColleagueHeaderBarProps = {
  colleagueName: 'Alice Smith',
  isAdmin: true,
  isEditing: false,
  editName: 'Alice Smith',
  isSaving: false,
  onEditNameChange: vi.fn(),
  onStartEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onRecordPayment: vi.fn(),
  onDelete: vi.fn(),
};

describe('ColleagueHeaderBar', () => {
  it('renders colleague name', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByTestId('colleague-name-text')).toHaveTextContent('Alice Smith');
  });

  it('renders back link to /colleagues/', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    const backLink = screen.getByTestId('back-link');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/colleagues/');
  });

  it('renders avatar with colleague name', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice Smith');
  });

  it('shows action buttons for admin', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByTestId('record-payment-header-btn')).toBeInTheDocument();
    expect(screen.getByTestId('edit-name-btn')).toBeInTheDocument();
    expect(screen.getByTestId('more-actions-btn')).toBeInTheDocument();
  });

  it('hides action buttons for non-admin', () => {
    render(<ColleagueHeaderBar {...defaultProps} isAdmin={false} />);
    expect(screen.queryByTestId('record-payment-header-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-name-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('more-actions-btn')).not.toBeInTheDocument();
  });

  it('shows edit input when editing as admin', () => {
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} />);
    expect(screen.getByTestId('edit-name-input')).toBeInTheDocument();
    expect(screen.queryByTestId('colleague-name-text')).not.toBeInTheDocument();
  });

  it('shows name text when not editing', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByTestId('colleague-name-text')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-name-input')).not.toBeInTheDocument();
  });

  it('calls onStartEdit on edit button click', async () => {
    const user = userEvent.setup();
    const onStartEdit = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} onStartEdit={onStartEdit} />);
    await user.click(screen.getByTestId('edit-name-btn'));
    expect(onStartEdit).toHaveBeenCalledOnce();
  });

  it('calls onSaveEdit on save button click', async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} onSaveEdit={onSaveEdit} />);
    await user.click(screen.getByTestId('save-btn'));
    expect(onSaveEdit).toHaveBeenCalledOnce();
  });

  it('calls onCancelEdit on cancel button click', async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} onCancelEdit={onCancelEdit} />);
    await user.click(screen.getByTestId('cancel-btn'));
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });

  it('calls onSaveEdit on Enter key in edit input', async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} onSaveEdit={onSaveEdit} />);
    const input = screen.getByTestId('edit-name-input');
    await user.type(input, '{Enter}');
    expect(onSaveEdit).toHaveBeenCalledOnce();
  });

  it('calls onCancelEdit on Escape key in edit input', async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} onCancelEdit={onCancelEdit} />);
    const input = screen.getByTestId('edit-name-input');
    await user.type(input, '{Escape}');
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });

  it('disables save button when editName is empty', () => {
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} editName="" />);
    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('disables save button when editName is whitespace only', () => {
    const whitespace = '   ';
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} editName={whitespace} />);
    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('disables save button when isSaving', () => {
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} isSaving={true} />);
    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('disables edit input when isSaving', () => {
    render(<ColleagueHeaderBar {...defaultProps} isEditing={true} isSaving={true} />);
    expect(screen.getByTestId('edit-name-input')).toBeDisabled();
  });

  it('calls onRecordPayment on record payment click', async () => {
    const user = userEvent.setup();
    const onRecordPayment = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} onRecordPayment={onRecordPayment} />);
    await user.click(screen.getByTestId('record-payment-header-btn'));
    expect(onRecordPayment).toHaveBeenCalledOnce();
  });

  it('opens dropdown and calls onDelete on delete click', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<ColleagueHeaderBar {...defaultProps} onDelete={onDelete} />);

    // Open the dropdown menu
    await user.click(screen.getByTestId('more-actions-btn'));

    // Click the delete menu item
    const deleteItem = screen.getByTestId('deactivate-colleague-menuitem');
    await user.click(deleteItem);

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
