import {
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  MoreHorizontal,
  Receipt,
  Users,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import type { ExpenseParticipantWithColleague } from '@/types';
import { AdminOnly } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';

export function unappliedCreditAmount(
  unappliedFunds: Record<number, number>,
  colleagueId: number | undefined
): number {
  return unappliedFunds[colleagueId ?? 0] || 0;
}

export function colleagueSortName(colleague?: { name?: string } | null): string {
  return colleague?.name || '';
}

interface ExpenseParticipantsProps {
  /** List of expense participants */
  participants: ExpenseParticipantWithColleague[];
  /** Grouped expense items by participant */
  participantItems?: Record<number, Array<{ id: number; name: string; price: number }>>;
  /** Pending claims by colleague */
  pendingClaimsByColleague: Record<
    number,
    {
      participantId: number;
      submittedAt: Date;
      hasPaymentProof: boolean;
      paymentId: number;
    }
  >;
  /** Processing states */
  isProcessingClaim: Record<number, boolean>;
  /** Payment action handlers */
  onOpenPaymentModal: (participant: ExpenseParticipantWithColleague) => void;
  onApprovePayment: (participantId: number) => void;
  onUndoPaymentClaim: (participantId: number) => void;
  onViewPaymentProof: (paymentId: number) => void;
  onAssignToPrepayment: (participantId: number) => void;
  /** Map of colleagueId to their unapplied funds */
  unappliedFunds?: Record<number, number>;
}

type ParticipantActionProps = Omit<ExpenseParticipantsProps, 'participants'>;

interface ParticipantListItemProps extends ParticipantActionProps {
  participant: ExpenseParticipantWithColleague;
  isPending: boolean;
}

const ParticipantListItem = ({
  participant,
  isPending,
  participantItems = {},
  isProcessingClaim,
  onOpenPaymentModal,
  onApprovePayment,
  onUndoPaymentClaim,
  onViewPaymentProof,
  onAssignToPrepayment,
  unappliedFunds = {},
  pendingClaimsByColleague,
}: ParticipantListItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const items = useMemo(
    () => participantItems[participant.colleague?.id || 0] || [],
    [participantItems, participant.colleague?.id]
  );
  const hasUnappliedFunds =
    participant.colleague && (unappliedFunds[participant.colleague.id] || 0) > 0.01;
  const hasPendingClaim = pendingClaimsByColleague[participant.colleague?.id || 0];

  const primaryAction = useMemo(() => {
    if (participant.isPaid) return null;

    if (isPending) {
      return (
        <AdminOnly>
          <Button
            size="sm"
            onClick={() => onApprovePayment(participant.id)}
            disabled={isProcessingClaim[participant.id]}
            className="w-full sm:w-auto sm:min-w-[140px] h-9 bg-success hover:bg-success"
          >
            {isProcessingClaim[participant.id] ? (
              <Clock className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {m.expense_detail_confirmPayment()}
          </Button>
        </AdminOnly>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => onOpenPaymentModal(participant)}
        disabled={isProcessingClaim[participant.id]}
        className="w-full sm:w-auto sm:min-w-[140px] h-9"
        data-testid="mark-as-paid-btn"
      >
        {isProcessingClaim[participant.id] ? <Clock className="h-4 w-4 animate-spin mr-2" /> : null}
        {m.expense_detail_markAsPaid()}
      </Button>
    );
  }, [participant, isPending, isProcessingClaim, onApprovePayment, onOpenPaymentModal]);

  const secondaryActions = useMemo(() => {
    const actions: ReactNode[] = [];
    if (!participant.isPaid) {
      if (isPending) {
        actions.push(
          <DropdownMenuItem
            key="cancel"
            onClick={() => onUndoPaymentClaim(participant.id)}
            disabled={isProcessingClaim[participant.id] ?? false}
            className="text-destructive-text hover:text-destructive-text"
          >
            {m.expense_detail_cancelClaim()}
          </DropdownMenuItem>
        );
      }
      if (hasUnappliedFunds) {
        actions.push(
          <AdminOnly key="apply-credit">
            <DropdownMenuItem
              onClick={() => onAssignToPrepayment(participant.id)}
              disabled={isProcessingClaim[participant.id] ?? false}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              <span>
                {m.expense_detail_applyCredit({
                  amount: formatCurrency(
                    unappliedCreditAmount(unappliedFunds, participant.colleague?.id)
                  ),
                })}
              </span>
            </DropdownMenuItem>
          </AdminOnly>
        );
      }
    }

    if (hasPendingClaim?.hasPaymentProof) {
      actions.push(
        <AdminOnly key="view-proof">
          <DropdownMenuItem onClick={() => onViewPaymentProof(hasPendingClaim.paymentId)}>
            <Receipt className="h-4 w-4 mr-2" />
            {m.expense_detail_viewPaymentProof()}
          </DropdownMenuItem>
        </AdminOnly>
      );
    }
    return actions;
  }, [
    participant,
    isPending,
    hasUnappliedFunds,
    hasPendingClaim,
    isProcessingClaim,
    onUndoPaymentClaim,
    onAssignToPrepayment,
    onViewPaymentProof,
    unappliedFunds,
  ]);

  return (
    <div className="border-t">
      <div className="p-3 hover:bg-accent transition-colors">
        <div className="flex items-center gap-3">
          {/* Avatar and Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <EnhancedAvatar
              name={participant.colleague?.name || m.common_unknown()}
              size="sm"
              className="h-9 w-9 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {participant.colleague?.name || m.expense_detail_unknownColleague()}
              </p>
            </div>
          </div>

          {/* Amount and Status */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-foreground text-lg">
              {formatCurrency(participant.amount)}
            </div>
            {(() => {
              const totalPaidAmount = participant.totalPaid ?? 0;
              if (totalPaidAmount <= 0.01) {
                return null;
              }
              return (
                <div className="text-xs text-muted-foreground">
                  {m.expense_detail_paidLabel({
                    amount: formatCurrency(totalPaidAmount),
                  })}
                </div>
              );
            })()}
          </div>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {primaryAction}
            {secondaryActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{secondaryActions}</DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Expand Button */}
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-9 w-9 p-0"
              aria-label={isExpanded ? 'Collapse items' : 'Expand items'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {/* Mobile actions */}
        <div className="sm:hidden mt-3 flex items-center gap-2">
          {primaryAction}
          {secondaryActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">{secondaryActions}</DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-muted/50 border-t p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {items.length === 1
              ? m.expense_detail_itemOrdered({ count: items.length })
              : m.expense_detail_itemsOrdered({ count: items.length })}
          </p>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-baseline gap-2">
                <span className="text-foreground text-sm flex-1">{item.name}</span>
                <span className="font-semibold text-foreground text-sm flex-shrink-0">
                  {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CollapsibleSectionProps extends ParticipantActionProps {
  title: string;
  participants: ExpenseParticipantWithColleague[];
  status: 'paid' | 'pending' | 'unpaid';
  defaultOpen?: boolean;
}

const CollapsibleParticipantSection = (props: CollapsibleSectionProps) => {
  const { title, participants, status, defaultOpen = false, ...rest } = props;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) =>
        colleagueSortName(a.colleague).localeCompare(colleagueSortName(b.colleague))
      ),
    [participants]
  );

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer w-full flex justify-between items-center p-4 bg-muted/80 hover:bg-accent/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'paid'
                ? 'bg-success'
                : status === 'pending'
                  ? 'bg-warning'
                  : 'bg-destructive'
            }`}
          />
          <h3 className="font-semibold text-lg text-foreground">
            {title}
            <span className="text-base text-muted-foreground font-normal ml-2">
              ({participants.length})
            </span>
          </h3>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="bg-card">
          {sortedParticipants.map((p) => (
            <ParticipantListItem
              key={p.id}
              participant={p}
              isPending={status === 'pending'}
              {...rest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Expense participants display component
 * Shows participant details, payment status, and available actions in a compact, grouped list.
 */
export const ExpenseParticipants = (props: ExpenseParticipantsProps) => {
  const { participants, pendingClaimsByColleague } = props;

  const { unpaid, pending, paid } = useMemo(() => {
    const unpaid: ExpenseParticipantWithColleague[] = [];
    const pending: ExpenseParticipantWithColleague[] = [];
    const paid: ExpenseParticipantWithColleague[] = [];

    participants.forEach((p) => {
      if (p.isPaid) {
        paid.push(p);
      } else if (pendingClaimsByColleague[p.colleague?.id || 0]) {
        pending.push(p);
      } else {
        unpaid.push(p);
      }
    });

    return { unpaid, pending, paid };
  }, [participants, pendingClaimsByColleague]);

  const { participants: _unusedParticipants, ...restProps } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>{m.expense_detail_whoOwesWhat()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-hidden">
          <CollapsibleParticipantSection
            title={m.expense_status_unpaid()}
            participants={unpaid}
            status="unpaid"
            defaultOpen
            {...restProps}
          />
          <CollapsibleParticipantSection
            title={m.expense_detail_pendingApproval()}
            participants={pending}
            status="pending"
            defaultOpen
            {...restProps}
          />
          <CollapsibleParticipantSection
            title={m.expense_detail_paid()}
            participants={paid}
            status="paid"
            {...restProps}
          />
        </div>
      </CardContent>
    </Card>
  );
};
