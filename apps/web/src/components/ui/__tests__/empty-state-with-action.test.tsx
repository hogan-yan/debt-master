import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyStateWithAction } from '../empty-state-with-action';

describe('EmptyStateWithAction', () => {
  it('renders title, description, and action button', () => {
    render(
      <EmptyStateWithAction
        title="No items"
        description="Get started by adding one"
        actionText="Add Item"
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Get started by adding one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('calls onAction when button clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<EmptyStateWithAction actionText="Create" onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyStateWithAction
        actionText="Go"
        onAction={vi.fn()}
        icon={<span data-testid="icon">Icon</span>}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('uses custom heading level', () => {
    render(
      <EmptyStateWithAction title="Heading" actionText="Go" onAction={vi.fn()} headingLevel="h2" />
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading');
  });

  it('does not render title when not provided', () => {
    render(<EmptyStateWithAction actionText="Go" onAction={vi.fn()} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyStateWithAction actionText="Go" onAction={vi.fn()} />);
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyStateWithAction actionText="Go" onAction={vi.fn()} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses custom action variant', () => {
    render(
      <EmptyStateWithAction actionText="Delete" onAction={vi.fn()} actionVariant="destructive" />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
