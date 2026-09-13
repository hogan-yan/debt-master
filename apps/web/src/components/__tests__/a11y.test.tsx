import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';

import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { LoginForm } from '@/components/login-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner, LoadingStateWrapper } from '@/components/ui/loading-state-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ThemeProvider } from '@/hooks';
import { AuthProvider } from '@/utils/auth-context';

expect.extend(toHaveNoViolations);

describe('Accessibility — Core UI Components', () => {
  describe('Button', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard accessible', () => {
      const handleClick = vi.fn();
      const { getByRole } = render(<Button onClick={handleClick}>Click me</Button>);
      const button = getByRole('button');
      button.focus();
      button.click();
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Input + Label', () => {
    it('should have no a11y violations when associated with label', async () => {
      const { container } = render(
        <>
          <Label htmlFor="test-input">Test Label</Label>
          <Input id="test-input" placeholder="Enter text" />
        </>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass a11y with aria-label when visible label is absent', async () => {
      const { container } = render(<Input placeholder="Search" aria-label="Search query" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Table', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Alice</TableCell>
              <TableCell>$100</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Alert', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong</AlertDescription>
        </Alert>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have role="alert"', () => {
      const { getByRole } = render(
        <Alert>
          <AlertDescription>Warning message</AlertDescription>
        </Alert>
      );
      expect(getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Checkbox', () => {
    it('should have no a11y violations with label', async () => {
      const { container } = render(
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label htmlFor="terms">Accept terms</Label>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Card', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Dialog', () => {
    it('should have no a11y violations when open', async () => {
      const { container } = render(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <p>Dialog content</p>
          </DialogContent>
        </Dialog>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('PageHeader', () => {
    it('should render h1 heading', () => {
      const { getByRole } = render(<PageHeader title="Page Title" />);
      expect(getByRole('heading', { level: 1 })).toHaveTextContent('Page Title');
    });

    it('should have no a11y violations', async () => {
      const { container } = render(<PageHeader title="Page Title" subtitle="Subtitle" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('DashboardTabs', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <>
          <DashboardTabs activeTab="overview" onTabChange={() => {}} />
          <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
            Overview content
          </div>
          <div id="panel-debtors" role="tabpanel" aria-labelledby="tab-debtors" hidden>
            Debtors content
          </div>
          <div id="panel-restaurants" role="tabpanel" aria-labelledby="tab-restaurants" hidden>
            Restaurants content
          </div>
          <div id="panel-spending" role="tabpanel" aria-labelledby="tab-spending" hidden>
            Spending content
          </div>
        </>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have tablist role', () => {
      const { getByRole } = render(<DashboardTabs activeTab="overview" onTabChange={() => {}} />);
      expect(getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('DeleteConfirmationDialog', () => {
    it('should have no a11y violations when open', async () => {
      const { container } = render(
        <DeleteConfirmationDialog
          isOpen
          onOpenChange={() => {}}
          title="Confirm Delete"
          message="Are you sure?"
          onConfirm={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('EmptyStateWithAction', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <EmptyStateWithAction
          title="No items"
          description="Get started by creating one"
          actionText="Create"
          onAction={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('LoadingStateWrapper', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(
        <LoadingStateWrapper isLoading={false}>
          <p>Content loaded</p>
        </LoadingStateWrapper>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('LoadingSpinner', () => {
    it('should have no a11y violations', async () => {
      const { container } = render(<LoadingSpinner />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

describe('Accessibility — Remediated Issues', () => {
  it('LoginForm should have no a11y violations', async () => {
    const { container } = render(
      <AuthProvider>
        <ThemeProvider>
          <LoginForm />
        </ThemeProvider>
      </AuthProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
