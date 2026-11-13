import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColleagueHeaderBar, type ColleagueHeaderBarProps } from './colleague-header-bar';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
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
  it('renders colleague name and avatar', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('shows Record Payment button for admin', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
  });

  it('hides Record Payment button for non-admin', () => {
    render(<ColleagueHeaderBar {...defaultProps} isAdmin={false} />);
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument();
  });

  it('toggles to input mode on edit click', async () => {
    const user = userEvent.setup();
    render(<ColleagueHeaderBar {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: /edit/i });
    await user.click(editBtn);
    expect(defaultProps.onStartEdit).toHaveBeenCalled();
  });

  it('updates, saves, and cancels the editable name from keyboard', async () => {
    const user = userEvent.setup();
    const onEditNameChange = vi.fn();
    const onSaveEdit = vi.fn();
    const onCancelEdit = vi.fn();
    render(
      <ColleagueHeaderBar
        {...defaultProps}
        isEditing
        onEditNameChange={onEditNameChange}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />
    );

    const input = screen.getByRole('textbox', { name: /edit colleague name/i });
    await user.clear(input);
    await user.type(input, 'Bob');
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');

    expect(onEditNameChange).toHaveBeenCalled();
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('renders More dropdown with admin actions', () => {
    render(<ColleagueHeaderBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });
});
