import { Building2, ChevronDown, CreditCard, MoreHorizontal, Receipt } from 'lucide-react';
import { useState } from 'react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BADGE_CLASSES, CONTAINER_CLASSES, SIZE_CLASSES } from '@/styles/class-constants';
import { type PaymentType } from '@/types/common';
import { formatCurrency, formatDate } from '@/utils/formatters';

export interface PaymentMobileCardData {
  id: number;
  colleagueName: string;
  amount: number;
  paymentType: PaymentType;
  date: string;
  isApproved: boolean;
  expenseName: string | null | undefined;
  expenseId: number | null | undefined;
  restaurantName: string | null | undefined;
  hasProof: boolean;
  applications: { amount: number; expenseName?: string; expenseId?: number }[];
  createdBy?: string | null;
}

type PaymentAction = 'edit' | 'delete' | 'viewProof' | 'goToExpense' | 'goToSpecificExpense';

interface PaymentMobileCardProps {
  payment: PaymentMobileCardData;
  onAction: (
    action: PaymentAction,
    payment: PaymentMobileCardData,
    extra?: { expenseId?: number }
  ) => void;
}

type PaymentTypeLabel = 'Payme' | 'FPS' | 'Cash' | 'Other';

const PAYMENT_TYPE_LABELS: Record<PaymentType, PaymentTypeLabel> = {
  PAYME: 'Payme',
  FPS: 'FPS',
  CASH: 'Cash',
  OTHER: 'Other',
};

const MUTED_BADGE = 'bg-muted text-muted-foreground';

export function PaymentMobileCard({ payment, onAction }: PaymentMobileCardProps) {
  const { amount, applications } = payment;
  const totalApplied = applications?.reduce((sum, app) => sum + app.amount, 0) ?? 0;
  const hasCredit = amount > totalApplied;
  const isPurePrepayment = !applications || applications.length === 0;

  const paymentTypeLabel = PAYMENT_TYPE_LABELS[payment.paymentType];

  const [isApplicationsExpanded, setIsApplicationsExpanded] = useState(false);

  return (
    <Card className={CONTAINER_CLASSES.CARD_BASE}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <EnhancedAvatar name={payment.colleagueName} size="sm" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-medium text-foreground block leading-snug">
                {payment.colleagueName}
              </span>
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full flex-shrink-0',
                  payment.isApproved ? 'bg-success' : 'bg-warning'
                )}
                role="img"
                aria-label={payment.isApproved ? 'Approved' : 'Pending'}
              />
            </div>

            <div className="text-lg font-bold text-foreground mt-0.5">
              {formatCurrency(payment.amount)}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn(BADGE_CLASSES.BADGE_SMALL, MUTED_BADGE)}>{paymentTypeLabel}</span>
              <span className={cn(BADGE_CLASSES.BADGE_SMALL, MUTED_BADGE)}>
                {isPurePrepayment ? 'Prepayment' : 'Expense Payment'}
              </span>
              {(hasCredit || isPurePrepayment) && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  {isPurePrepayment
                    ? 'Full credit'
                    : `${formatCurrency(amount - totalApplied)} credit`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{formatDate(payment.date)}</span>
              {payment.hasProof && <Receipt className="h-3 w-3 flex-shrink-0" />}
              {payment.restaurantName && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span className="truncate">{payment.restaurantName}</span>
                </>
              )}
              {payment.createdBy === 'ADMIN' && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Admin</span>
                </>
              )}
              {payment.createdBy === 'SYSTEM_AUTO_PAYMENT' && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Auto</span>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={SIZE_CLASSES.BUTTON_TOUCH}
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {payment.hasProof && (
                  <DropdownMenuItem
                    className="min-h-[44px]"
                    onClick={() => onAction('viewProof', payment)}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Payment Proof
                  </DropdownMenuItem>
                )}
                {payment.expenseName && (
                  <DropdownMenuItem
                    className="min-h-[44px]"
                    onClick={() => onAction('goToExpense', payment)}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    View Related Expense
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="min-h-[44px]"
                  onClick={() => onAction('edit', payment)}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-[44px] text-destructive-text focus:text-destructive-text"
                  onClick={() => onAction('delete', payment)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {applications && applications.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsApplicationsExpanded(!isApplicationsExpanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground w-full text-left"
            >
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200 flex-shrink-0',
                  isApplicationsExpanded && 'rotate-180'
                )}
              />
              <span>
                {applications.length} expense{applications.length !== 1 ? 's' : ''} &middot;{' '}
                {formatCurrency(totalApplied)} applied
              </span>
            </button>
            <div
              className={cn(
                'overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out',
                isApplicationsExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="pt-2 space-y-1">
                {applications.map((app, i) => (
                  <div
                    key={app.expenseId ?? i}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      {app.expenseName ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            if (app.expenseId != null)
                              onAction('goToSpecificExpense', payment, {
                                expenseId: app.expenseId,
                              });
                          }}
                          className="h-auto p-0 text-foreground hover:text-foreground/80 text-left min-w-0"
                        >
                          <span className="truncate">{app.expenseName}</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground truncate">Unknown Restaurant</span>
                      )}
                    </div>
                    <span className="font-medium text-foreground flex-shrink-0 whitespace-nowrap">
                      {formatCurrency(app.amount)}
                    </span>
                  </div>
                ))}
                <div className="pt-1 border-t border-border">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground">Total Applied:</span>
                    <span className="text-foreground">{formatCurrency(totalApplied)}</span>
                  </div>
                  {hasCredit && (
                    <div className="flex items-center justify-between text-xs font-medium mt-0.5">
                      <span className="text-foreground">Remaining Credit:</span>
                      <span className="text-foreground">
                        {formatCurrency(amount - totalApplied)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isPurePrepayment && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Available as Credit:</span>
              <span className="font-medium text-foreground">{formatCurrency(payment.amount)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
