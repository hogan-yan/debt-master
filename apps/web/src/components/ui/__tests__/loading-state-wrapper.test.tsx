import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay, LoadingSpinner, LoadingStateWrapper } from '../loading-state-wrapper';

describe('LoadingStateWrapper', () => {
  it('renders children when not loading', () => {
    render(
      <LoadingStateWrapper isLoading={false}>
        <div data-testid="content">Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders custom loading component when provided', () => {
    render(
      <LoadingStateWrapper
        isLoading={true}
        loadingComponent={<div data-testid="custom">Custom</div>}
      >
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('renders table skeleton by default', () => {
    render(
      <LoadingStateWrapper isLoading={true}>
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders cards skeleton when type is cards', () => {
    render(
      <LoadingStateWrapper isLoading={true} skeletonType="cards">
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders custom skeleton when type is custom', () => {
    render(
      <LoadingStateWrapper isLoading={true} skeletonType="custom">
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <LoadingStateWrapper isLoading={true} className="custom-loading">
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(container.querySelector('.custom-loading')).toBeInTheDocument();
  });

  it('uses custom skeleton count', () => {
    render(
      <LoadingStateWrapper isLoading={true} skeletonType="custom" skeletonCount={3}>
        <div>Content</div>
      </LoadingStateWrapper>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('renders spinner', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-spinner" />);
    expect(container.firstChild).toHaveClass('custom-spinner');
  });
});

describe('LoadingOverlay', () => {
  it('renders null when not visible', () => {
    const { container } = render(<LoadingOverlay isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when visible', () => {
    render(<LoadingOverlay isVisible={true} />);
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
  });

  it('renders custom children instead of spinner', () => {
    render(
      <LoadingOverlay isVisible={true}>
        <div data-testid="custom-overlay">Custom</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('custom-overlay')).toBeInTheDocument();
  });
});
