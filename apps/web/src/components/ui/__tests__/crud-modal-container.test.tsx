import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CRUDModalContainer } from '../crud-modal-container';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-open={open} data-testid="dialog">
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    className,
    'data-testid': testid,
  }: {
    children: React.ReactNode;
    className?: string;
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={testid}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

describe('CRUDModalContainer', () => {
  it('renders with title and children', () => {
    render(
      <CRUDModalContainer isOpen={true} onOpenChange={vi.fn()} title="Create Item">
        <div data-testid="modal-content">Content</div>
      </CRUDModalContainer>
    );
    expect(screen.getByText('Create Item')).toBeInTheDocument();
    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
  });

  it('applies default max width class', () => {
    const { container } = render(
      <CRUDModalContainer isOpen={true} onOpenChange={vi.fn()} title="Test">
        <div>Content</div>
      </CRUDModalContainer>
    );
    const dialogContent = container.querySelector('[data-testid="dialog"] > div');
    expect(dialogContent?.className).toContain('sm:max-w-lg');
  });

  it('applies custom max width class', () => {
    const { container } = render(
      <CRUDModalContainer isOpen={true} onOpenChange={vi.fn()} title="Test" maxWidth="2xl">
        <div>Content</div>
      </CRUDModalContainer>
    );
    const dialogContent = container.querySelector('[data-testid="dialog"] > div');
    expect(dialogContent?.className).toContain('sm:max-w-2xl');
  });

  it('applies custom className', () => {
    const { container } = render(
      <CRUDModalContainer
        isOpen={true}
        onOpenChange={vi.fn()}
        title="Test"
        className="custom-modal"
      >
        <div>Content</div>
      </CRUDModalContainer>
    );
    const dialogContent = container.querySelector('[data-testid="dialog"] > div');
    expect(dialogContent?.className).toContain('custom-modal');
  });

  it('applies data-testid', () => {
    render(
      <CRUDModalContainer isOpen={true} onOpenChange={vi.fn()} title="Test" data-testid="my-modal">
        <div>Content</div>
      </CRUDModalContainer>
    );
    expect(screen.getByTestId('my-modal')).toBeInTheDocument();
  });
});
