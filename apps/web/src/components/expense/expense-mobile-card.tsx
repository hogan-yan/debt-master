import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  MapPin,
  Receipt,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { memo, useState } from 'react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateWithBadge } from '@/components/ui/date-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { m } from '@/paraglide/messages';
import { CONTAINER_CLASSES } from '@/styles/class-constants';
import { formatCurrency } from '@/utils/formatters';

// Paid/pending/unpaid status pill on the mobile participant row. unslop-ignore
const PARTICIPANT_STATUS_PILL_CLASS =
  'px-2 py-1 rounded-full text-xs font-medium border transition-colors'; // unslop-ignore

export function compareParticipantPaidStatus(aIsPaid: boolean, bIsPaid: boolean): number {
  if (aIsPaid === bIsPaid) {
    return 0;
  }
  return aIsPaid ? 1 : -1;
}

export function expenseDateToString(date: string | Date): string {
  return typeof date === 'string' ? date : date.toISOString();
}

export function colleagueIdOrZero(colleague?: { id: number } | null): number {
  return colleague?.id || 0;
}

interface ExpenseMobileCardProps {
  expense: {
    id: number;
    amount: number;
    date: string | Date;
    receiptBucket?: string | null;
    receiptObjectKey?: string | null;
    restaurant?:
      | {
          id: number;
          name: string;
          address?: string | null;
        }
      | null
      | undefined;
    participants?: Array<{
      id: number;
      amount: number;
      isPaid: boolean;
      colleague?:
        | {
            id: number;
            name: string;
          }
        | null
        | undefined;
    }>;
    items?: Array<{
      id: number;
      name: string;
      price: number;
    }>;
  };
  showParticipants?: boolean;
  onReceiptClick?: ((expenseId: number) => void) | undefined;
  onPaymentClaim?: ((participantId: number) => void) | undefined;
  pendingClaimsByColleague?:
    | Record<
        number,
        {
          participantId: number;
          submittedAt: Date;
          hasPaymentProof: boolean;
          paymentId: number;
        }
      >
    | undefined;
  isProcessingClaim?: Record<number, boolean> | undefined;
}

export const ExpenseMobileCard = memo(
  ({
    expense,
    showParticipants = true,
    onReceiptClick,
    pendingClaimsByColleague,
  }: ExpenseMobileCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const totalPaid =
      expense.participants?.reduce((sum, p) => (p.isPaid ? sum + p.amount : sum), 0) || 0;

    const totalParticipants = expense.participants?.length || 0;
    const unpaidParticipantsCount = expense.participants?.filter((p) => !p.isPaid).length || 0;

    const [showPaidParticipants, setShowPaidParticipants] = useState(unpaidParticipantsCount === 0);

    const paymentProgress = expense.amount > 0 ? (totalPaid / expense.amount) * 100 : 0;

    const getPaymentStatusColor = () => {
      if (paymentProgress === 100) return 'text-success';
      if (paymentProgress > 50) return 'text-warning';
      return 'text-destructive-text';
    };

    const getPaymentStatusIcon = () => {
      if (paymentProgress === 100) return CheckCircle2;
      if (paymentProgress > 0) return AlertCircle;
      return XCircle;
    };

    const PaymentStatusIcon = getPaymentStatusIcon();

    const participantsToList = expense.participants
      ? expense.participants
          .filter((p) => showPaidParticipants || !p.isPaid)
          .sort((a, b) => compareParticipantPaidStatus(a.isPaid, b.isPaid))
      : [];

    const paidParticipantsCount = totalParticipants - unpaidParticipantsCount;

    return (
      <Card className={CONTAINER_CLASSES.CARD_BASE}>
        <CardContent className="p-4">
          {/* Compact Header Section */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-3">
              <Link
                to="/expense/$id/"
                params={{ id: expense.id.toString() }}
                className="block group"
              >
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-bold text-lg text-foreground group-hover:text-info/80 transition-colors truncate">
                    {expense.restaurant?.name || m.expense_detail_unknownRestaurant()}
                  </h3>
                  <TrendingUp className="h-3 w-3 text-info opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                {expense.restaurant?.address && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <p className="truncate">{expense.restaurant.address}</p>
                  </div>
                )}
              </Link>
              {totalParticipants > 0 && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-2">
                  <Users className="h-3 w-3 flex-shrink-0" />
                  <p>{totalParticipants}</p>
                </div>
              )}
              <DateWithBadge dateString={expenseDateToString(expense.date)} />
            </div>

            <div className="text-right">
              <div className="text-xl font-bold text-foreground mb-1">
                {formatCurrency(expense.amount)}
              </div>
              <div className="flex items-center justify-end space-x-1">
                <PaymentStatusIcon className={`h-3 w-3 ${getPaymentStatusColor()}`} />
                <span className={`text-xs font-medium ${getPaymentStatusColor()}`}>
                  {Math.round(paymentProgress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Compact Progress Bar */}
          <div className="mb-3">
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-[width] duration-500 ease-out ${
                  paymentProgress === 100
                    ? 'bg-success'
                    : paymentProgress > 50
                      ? 'bg-warning'
                      : 'bg-destructive'
                }`}
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Link to="/expense/$id/" params={{ id: expense.id.toString() }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 bg-card/80 backdrop-blur-sm hover:bg-accent hover:border-info/30 hover:text-info/80 transition duration-200"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              </Link>
              {onReceiptClick && expense.receiptBucket && expense.receiptObjectKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReceiptClick(expense.id)}
                  className="h-8 px-3 bg-card/80 backdrop-blur-sm hover:bg-accent hover:border-border hover:text-foreground transition duration-200"
                >
                  <Receipt className="h-3 w-3 mr-1" />
                  Receipt
                </Button>
              )}
            </div>

            {showParticipants && expense.participants && expense.participants.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`h-8 w-8 p-0 rounded-full transition duration-200 hover:bg-accent ${isExpanded ? 'bg-accent rotate-180' : ''}`}
              >
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
              </Button>
            )}
          </div>

          {/* Compact Expandable Participants Section */}
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${showParticipants && isExpanded ? 'max-h-200 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            {expense.participants && expense.participants.length > 0 && (
              <div className="pt-3 mt-3 border-t border-border">
                <div className="flex items-center space-x-2 mb-3">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-sm font-medium text-foreground">Participants</h4>
                </div>

                <div className="space-y-2 max-h-200 overflow-y-auto pr-1">
                  {participantsToList.map((participant) => {
                    const isPending =
                      participant.isPaid === false &&
                      pendingClaimsByColleague?.[colleagueIdOrZero(participant.colleague)];

                    return (
                      <div
                        key={participant.id}
                        className={
                          'flex items-center justify-between p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border hover:bg-card/80 transition duration-200'
                        }
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="relative">
                                  <EnhancedAvatar
                                    name={participant.colleague?.name || m.common_unknown()}
                                    size="sm"
                                    className="h-8 w-8 ring-2 ring-white shadow-sm"
                                  />
                                  <div
                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                      participant.isPaid
                                        ? 'bg-success'
                                        : isPending
                                          ? 'bg-warning'
                                          : 'bg-destructive'
                                    }`}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">
                                  {participant.colleague?.name || m.common_unknown()}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {participant.colleague?.name || m.common_unknown()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(participant.amount)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`${PARTICIPANT_STATUS_PILL_CLASS} ${
                            participant.isPaid
                              ? 'bg-success/10 text-success border-success/20'
                              : isPending
                                ? 'bg-warning/10 text-warning border-warning/20'
                                : 'bg-destructive/10 text-destructive-text border-destructive/20'
                          }`}
                        >
                          {participant.isPaid
                            ? `✓ ${m.expense_participant_paid()}`
                            : isPending
                              ? `⏳ ${m.expense_participant_pending()}`
                              : `❌ ${m.expense_participant_unpaid()}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Conditional buttons to show/hide paid participants */}
                {paidParticipantsCount > 0 && (
                  <div className="flex justify-center mt-2">
                    {showPaidParticipants && unpaidParticipantsCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPaidParticipants(false)}
                        className="w-full text-foreground hover:text-muted-foreground"
                      >
                        Show only unpaid participants
                        <ChevronDown className="h-4 w-4 ml-2 rotate-180" />
                      </Button>
                    )}
                    {!showPaidParticipants && paidParticipantsCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPaidParticipants(true)}
                        className="w-full text-foreground hover:text-muted-foreground"
                      >
                        Show all participants
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);
