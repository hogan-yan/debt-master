import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-avatar', () => ({
  Root: ({ children, ...props }: { children: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
  Image: ({ src, alt, ...props }: { src?: string; alt?: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
  Fallback: ({ children, ...props }: { children: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  colorFromHash,
  EnhancedAvatar,
  getInitialsColor,
} from '../avatar';

describe('Avatar', () => {
  it('renders Avatar with fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders AvatarImage when src provided', () => {
    render(
      <Avatar>
        <AvatarImage src="/img.png" alt="Test" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByRole('img', { name: 'Test' })).toBeInTheDocument();
  });
});

describe('EnhancedAvatar', () => {
  it('renders with name and fallback', () => {
    render(<EnhancedAvatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders with single word name', () => {
    render(<EnhancedAvatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders ? when no name', () => {
    render(<EnhancedAvatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders with src', () => {
    render(<EnhancedAvatar name="John" src="/img.png" alt="John" />);
    expect(screen.getByRole('img', { name: 'John' })).toBeInTheDocument();
  });

  it('uses the name as image alt text when alt is omitted', () => {
    render(<EnhancedAvatar name="John Doe" src="/img.png" />);
    expect(screen.getByRole('img', { name: 'John Doe' })).toBeInTheDocument();
  });

  it('uses an empty image alt text without a name', () => {
    const { container } = render(<EnhancedAvatar src="/img.png" />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('renders with size sm', () => {
    const { container } = render(<EnhancedAvatar name="Test" size="sm" />);
    expect(container.querySelector('[class*="h-7"]')).toBeInTheDocument();
  });

  it('renders with size lg', () => {
    const { container } = render(<EnhancedAvatar name="Test" size="lg" />);
    expect(container.querySelector('[class*="h-16"]')).toBeInTheDocument();
  });

  it('renders with size xl', () => {
    const { container } = render(<EnhancedAvatar name="Test" size="xl" />);
    expect(container.querySelector('[class*="h-20"]')).toBeInTheDocument();
  });

  it('limits initials to 2 characters', () => {
    render(<EnhancedAvatar name="One Two Three Four" />);
    expect(screen.getByText('OT')).toBeInTheDocument();
  });
});

describe('getInitialsColor', () => {
  it('returns gray for no name', () => {
    expect(getInitialsColor()).toBe('bg-gray-500');
  });

  it('returns a color for a name', () => {
    const color = getInitialsColor('John');
    expect(color).toMatch(/^bg-[a-z]+-400$/);
  });

  it('returns consistent color for same name', () => {
    expect(getInitialsColor('Alice')).toBe(getInitialsColor('Alice'));
  });
});

describe('colorFromHash', () => {
  it('returns fallback for empty palette', () => {
    expect(colorFromHash(1, [])).toBe('bg-gray-500');
  });

  it('returns fallback when indexed color is missing', () => {
    const sparse = { length: 1 } as unknown as string[];
    expect(colorFromHash(0, sparse)).toBe('bg-gray-500');
  });

  it('returns palette color for dense arrays', () => {
    expect(colorFromHash(0, ['bg-red-500'])).toBe('bg-red-500');
  });
});
