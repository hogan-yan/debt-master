/**
 * Pending Payments Card - Shows pending payments awaiting admin confirmation
 */

import { Link } from '@tanstack/react-router';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Receipt } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentProofViewModal } from '@/components/ui/payment-proof-modal';
import { m } from '@/paraglide/messages';
import { approvePaymentClaim, getPendingPaymentClaims, undoClaim } from '@/server/expenses';
import { getPaymentProofUrlByPaymentId } from '@/server/payments/queries';
import { formatCurrency, formatDateWithRelative } from '@/utils/formatters';

const POLL_INTERVAL_MS = 30000;

export function areSamePendingIds(
  previous: readonly { id: number }[],
  next: readonly { id: number }[]
): boolean {
  return (
    previous.length === next.length &&
    previous.every((payment, index) => payment.id === next[index]?.id)
  );
}

export function applyPendingPaymentsUpdate<T extends { id: number }>(
  previous: T[],
  next: T[]
): T[] {
  return areSamePendingIds(previous, next) ? previous : next;
}

export function shouldUpdateMounted(mounted: boolean): boolean {
  return mounted;
}

/**
 * Props for the PendingClaimsCard component
 */
interface PendingPaymentsCardProps {
  /** Initial pending payments preloaded from server */
  initialData?: PendingPayment[];
  /** Optional custom handler for approving payments */
  onApprove?: (participantId: number) => Promise<void>;
  /** Record of participant IDs currently being processed */
  isProcessing?: Record<number, boolean>;
}

/**
 * Represents a pending payment awaiting admin confirmation
 */
interface PendingPayment {
  id: number;
  participantId: number | null;
  amount: number;
  submittedAt: Date | null;
  paymentProofBucket?: string | null;
  paymentProofObjectKey?: string | null;
  colleague?:
    | {
        id: number;
        name: string;
      }
    | null
    | undefined;
  restaurant?:
    | {
        id: number;
        name: string;
      }
    | null
    | undefined;
  expense?:
    | {
        id: number;
        amount: number;
        date: Date | string;
      }
    | null
    | undefined;
}

/**
 * Card component that displays pending payments awaiting admin confirmation
 * Shows a collapsible list of payments that users have marked as paid
 * @param props - Component props
 * @returns JSX element
 */
export function PendingClaimsCard({
  initialData,
  onApprove,
  isProcessing = {},
}: PendingPaymentsCardProps) {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>(initialData ?? []);
  const [isLoading, setIsLoading] = useState(initialData === undefined);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localProcessing, setLocalProcessing] = useState<Record<number, boolean>>({});
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const mountedRef = useRef(true);

  const handleViewProof = async (paymentId: number) => {
    try {
      const result = await getPaymentProofUrlByPaymentId({ data: { paymentId } });
      if (result.url) {
        setProofUrl(result.url);
        setProofOpen(true);
      } else {
        toast.error(m.payment_toast_proofNotFound());
      }
    } catch {
      toast.error(m.payment_toast_proofLoadFailed());
    }
  };

  const fetchPendingPayments = useCallback(async () => {
    try {
      const payments = await getPendingPaymentClaims();
      if (!shouldUpdateMounted(mountedRef.current)) return;
      setPendingPayments((prev) => applyPendingPaymentsUpdate(prev, payments));
    } catch (_error) {
      if (!shouldUpdateMounted(mountedRef.current)) return;
    } finally {
      if (shouldUpdateMounted(mountedRef.current)) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchPendingPayments();

    const interval = setInterval(fetchPendingPayments, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchPendingPayments]);

  const handleApprove = async (participantId: number) => {
    if (onApprove) {
      // Use the passed handler if provided
      await onApprove(participantId);
      // Refresh the pending payments list after the parent handler completes
      fetchPendingPayments();
    } else {
      // Use internal handler with toast and undo
      setLocalProcessing((prev) => ({ ...prev, [participantId]: true }));

      try {
        await approvePaymentClaim({ data: { participantId } });

        // Show success toast with undo button
        toast.success(m.pendingClaim_confirmSuccess(), {
          description: m.pendingClaim_confirmSuccessDesc(),
          action: {
            label: m.payment_modal_undo(),
            onClick: async () => {
              try {
                await undoClaim({ data: { participantId, type: 'APPROVED' } });
                toast.success(m.pendingClaim_undoSuccess());
                fetchPendingPayments(); // Refresh the payments list
              } catch {
                toast.error(m.pendingClaim_undoFailed());
              }
            },
          },
          duration: 10000, // Give more time to undo since this is more complex
        });

        // Refresh the payments list
        fetchPendingPayments();
      } catch {
        toast.error(m.pendingClaim_confirmFailed());
      } finally {
        setLocalProcessing((prev) => {
          const { [participantId]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-foreground animate-spin" />
            <span className="text-foreground">{m.pendingClaim_loading()}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingPayments.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>{m.expense_no_pending_confirmations()}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PaymentProofViewModal
        isOpen={proofOpen}
        onClose={() => setProofOpen(false)}
        paymentProofUrl={proofUrl}
      />
      <Card className="border-warning/20 bg-warning/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              <span>{m.pendingClaim_title({ count: pendingPayments.length })}</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-warning hover:text-warning/80"
            >
              {isExpanded ? m.pendingClaim_hide() : m.pendingClaim_show()}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              {pendingPayments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-warning/20"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <EnhancedAvatar
                      name={payment.colleague?.name || m.pendingClaim_unknownColleague()}
                      size="sm"
                      className="h-8 w-8 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {payment.colleague?.name || m.pendingClaim_unknownColleague()}
                      </p>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-2">
                        {payment.restaurant?.name || m.pendingClaim_unknownRestaurant()} •{' '}
                        {formatCurrency(payment.amount)}
                        {payment.paymentProofBucket &&
                          payment.paymentProofObjectKey &&
                          payment.id && (
                            <button
                              type="button"
                              className="ml-2 text-foreground hover:text-muted-foreground focus:outline-none cursor-pointer"
                              title={m.pendingClaim_viewProof()}
                              onClick={() => handleViewProof(payment.id)}
                            >
                              <Receipt className="h-4 w-4 inline" />
                            </button>
                          )}
                        {payment.expense?.id && (
                          <Link
                            to="/expense/$id/"
                            params={{ id: payment.expense.id.toString() }}
                            target="_blank"
                            className="ml-2 text-muted-foreground hover:text-foreground"
                            title={m.pendingClaim_goToExpense()}
                          >
                            <ExternalLink className="h-4 w-4 inline" />
                          </Link>
                        )}
                      </p>
                      {payment.submittedAt && (
                        <p className="text-xs text-muted-foreground">
                          {m.pendingClaim_marked({
                            date: formatDateWithRelative(payment.submittedAt.toString()),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => payment.participantId && handleApprove(payment.participantId)}
                    disabled={
                      !payment.participantId ||
                      isProcessing[payment.participantId] ||
                      localProcessing[payment.participantId]
                    }
                    className="bg-success hover:bg-success/90 text-success-foreground flex-shrink-0"
                  >
                    {!payment.participantId ? (
                      m.pendingClaim_missingData()
                    ) : isProcessing[payment.participantId] ||
                      localProcessing[payment.participantId] ? (
                      <Clock className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {m.pendingClaim_confirm()}
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {pendingPayments.length > 5 && (
                <p className="text-sm text-warning text-center">
                  {m.pendingClaim_morePayments({ count: pendingPayments.length - 5 })}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}
