import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnhancedAvatar, getInitialsColor } from '../avatar';
import { Card, CardFooter } from '../card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../select';
import { StatisticCard } from '../statistic-card';
import { Table, TableCaption, TableCell, TableFooter, TableRow } from '../table';

describe('Select primitives', () => {
  it('renders SelectLabel without error', () => {
    const { container } = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Label</SelectLabel>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(container).toBeTruthy();
  });

  it('renders SelectSeparator without error', () => {
    const { container } = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="a">A</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(container).toBeTruthy();
  });
});

describe('Table primitives', () => {
  it('renders TableFooter', () => {
    render(
      <Table>
        <TableFooter data-testid="footer">
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders TableCaption', () => {
    render(
      <Table>
        <TableCaption>Caption</TableCaption>
      </Table>
    );
    expect(screen.getByText('Caption')).toBeInTheDocument();
  });
});

describe('Card primitives', () => {
  it('renders CardFooter', () => {
    render(
      <Card>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});

describe('StatisticCard', () => {
  it('renders optional content and its test identifier', () => {
    render(
      <StatisticCard
        title="Outstanding balance"
        value="$20.00"
        description="Across two expenses"
        icon={<span>Icon</span>}
        data-testid="outstanding-balance"
      />
    );

    expect(screen.getByTestId('outstanding-balance-value')).toHaveTextContent('$20.00');
    expect(screen.getByText('Across two expenses')).toBeInTheDocument();
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('renders without optional content', () => {
    render(<StatisticCard title="Outstanding balance" value="$20.00" />);

    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });
});

describe('Avatar primitives', () => {
  it('renders EnhancedAvatar fallback without src', () => {
    render(<EnhancedAvatar name="Jane Smith" />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders EnhancedAvatar fallback with question mark for no name', () => {
    render(<EnhancedAvatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('getInitialsColor returns consistent color', () => {
    const color1 = getInitialsColor('Alice');
    const color2 = getInitialsColor('Alice');
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^bg-/);
  });

  it('getInitialsColor returns default for empty name', () => {
    expect(getInitialsColor()).toBe('bg-gray-500');
  });
});
