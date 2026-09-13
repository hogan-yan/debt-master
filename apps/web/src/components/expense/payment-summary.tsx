import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';

// Per-stat summary cards. unslop-ignore: dashboard layout, not a marketing grid
const SUMMARY_GRID_3_GAP4 = 'grid grid-cols-1 md:grid-cols-3 gap-4'; // unslop-ignore

interface PaymentSummaryProps {
  /** List of participants with payment status */
  participants: Array<{
    isPaid: boolean;
    amount: number;
  }>;
  /** Total expense amount */
  totalAmount: number;
}

/**
 * Payment summary component
 * Displays payment statistics with collapsible mobile view
 */
export const PaymentSummary = ({ participants, totalAmount }: PaymentSummaryProps) => {
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);

  // Calculate payment statistics
  const totalPaid = participants.reduce((sum, p) => (p.isPaid ? sum + p.amount : sum), 0);
  const totalUnpaid = totalAmount - totalPaid;
  const paidCount = participants.filter((p) => p.isPaid).length;
  const totalParticipants = participants.length;

  // Set summary collapsed by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsSummaryCollapsed(window.innerWidth < 768); // md breakpoint is 768px
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{m.expense_detail_paymentSummary()}</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
            className="md:hidden"
          >
            {isSummaryCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`pt-0 ${isSummaryCollapsed ? 'hidden md:block' : 'block'}`}>
        <div className={SUMMARY_GRID_3_GAP4}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {m.expense_detail_totalParticipants()}
                  </p>
                  <p className="text-2xl font-bold text-foreground">{totalParticipants}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {m.expense_detail_amountPaid()}
                  </p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.expense_detail_paidCount({ count: paidCount })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {m.expense_detail_outstanding()}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(totalUnpaid)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.expense_detail_pendingCount({ count: totalParticipants - paidCount })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};
