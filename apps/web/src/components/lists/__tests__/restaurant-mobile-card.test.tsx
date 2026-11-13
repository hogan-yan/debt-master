import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '@/types';
import { RestaurantMobileCard } from '../restaurant-mobile-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}/`, `${v}/`);
      }
    }
    return <a href={href}>{children}</a>;
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

vi.mock('@/lib/schemas', () => ({
  getCuisineLabel: (c: string) => c,
}));

function createRestaurant(overrides?: Partial<Restaurant>): Restaurant {
  return {
    id: 1,
    name: 'Pizza Place',
    address: '123 Main St',
    cuisine: 'ITALIAN',
    totalExpenses: 5,
    totalAmount: 250,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('RestaurantMobileCard', () => {
  it('renders restaurant name and stats', () => {
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.getByText('Pizza Place')).toBeInTheDocument();
    expect(screen.getByText('5 restaurant_detail_expenses')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });

  it('shows address when present', () => {
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('hides address when null', () => {
    render(
      <RestaurantMobileCard
        restaurant={createRestaurant({ address: null })}
        isAdmin={false}
        onAction={() => {}}
      />
    );
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  it('shows cuisine badge', () => {
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={() => {}} />
    );
    expect(screen.getByText('ITALIAN')).toBeInTheDocument();
  });

  it('renders zero totals and singular expense text', () => {
    render(
      <RestaurantMobileCard
        restaurant={createRestaurant({ totalExpenses: 1, totalAmount: 0 })}
        isAdmin={false}
        onAction={() => {}}
      />
    );

    expect(screen.getByText('1 restaurant_detail_expense')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('uses zero totals when restaurant statistics are absent', () => {
    render(
      <RestaurantMobileCard
        restaurant={createRestaurant({ totalExpenses: undefined, totalAmount: undefined })}
        isAdmin={false}
        onAction={() => {}}
      />
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('calls view action from dropdown', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={onAction} />
    );
    await user.click(screen.getByLabelText('restaurant_actions_openMenu'));
    await user.click(screen.getByText('restaurant_actions_viewDetails'));
    expect(onAction).toHaveBeenCalledWith('view', expect.objectContaining({ id: 1 }));
  });

  it('calls edit action from dropdown for admin', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<RestaurantMobileCard restaurant={createRestaurant()} isAdmin onAction={onAction} />);
    await user.click(screen.getByLabelText('restaurant_actions_openMenu'));
    await user.click(screen.getByText('restaurant_actions_edit'));
    expect(onAction).toHaveBeenCalledWith('edit', expect.objectContaining({ id: 1 }));
  });

  it('calls delete action from dropdown for admin', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<RestaurantMobileCard restaurant={createRestaurant()} isAdmin onAction={onAction} />);
    await user.click(screen.getByLabelText('restaurant_actions_openMenu'));
    await user.click(screen.getByText('restaurant_actions_delete'));
    expect(onAction).toHaveBeenCalledWith('delete', expect.objectContaining({ id: 1 }));
  });

  it('shows edit/delete for admin', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<RestaurantMobileCard restaurant={createRestaurant()} isAdmin onAction={onAction} />);
    await user.click(screen.getByLabelText('restaurant_actions_openMenu'));
    expect(screen.getByText('restaurant_actions_edit')).toBeInTheDocument();
    expect(screen.getByText('restaurant_actions_delete')).toBeInTheDocument();
  });

  it('hides edit/delete for non-admin', async () => {
    const user = userEvent.setup();
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={() => {}} />
    );
    await user.click(screen.getByLabelText('restaurant_actions_openMenu'));
    expect(screen.queryByText('restaurant_actions_edit')).not.toBeInTheDocument();
    expect(screen.queryByText('restaurant_actions_delete')).not.toBeInTheDocument();
  });

  it('links to restaurant detail', () => {
    render(
      <RestaurantMobileCard restaurant={createRestaurant()} isAdmin={false} onAction={() => {}} />
    );
    const link = screen.getByText('Pizza Place').closest('a');
    expect(link).toHaveAttribute('href');
    expect(link?.getAttribute('href')).toContain('1');
  });
});

describe('restaurantStatOrZero', () => {
  it('returns value or zero', async () => {
    const { restaurantStatOrZero } = await import('../restaurant-mobile-card');
    expect(restaurantStatOrZero(5)).toBe(5);
    expect(restaurantStatOrZero(0)).toBe(0);
    expect(restaurantStatOrZero(null)).toBe(0);
    expect(restaurantStatOrZero(undefined)).toBe(0);
  });
});
