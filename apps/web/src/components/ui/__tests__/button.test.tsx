import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('renders as button by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/">Home link</a>
      </Button>
    );
    expect(screen.getByRole('link', { name: 'Home link' })).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="destructive">Del</Button>);
    expect(container.querySelector('[data-slot="button"]')).toHaveClass('bg-destructive');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.querySelector('[data-slot="button"]')).toHaveClass('h-8');
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="my-btn">Btn</Button>);
    expect(container.querySelector('[data-slot="button"]')).toHaveClass('my-btn');
  });
});
