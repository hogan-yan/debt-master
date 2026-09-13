import { ArrowLeft, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { getExpenseReceiptUrl } from '@/server/expenses';
import { AdminOnly } from '@/utils/auth-context';

interface ExpenseReceiptProps {
  /** Expense ID for fetching receipt */
  expenseId: number;
  /** Restaurant name for modal title */
  restaurantName?: string | undefined;
}

/**
 * Expense receipt display component
 * Handles receipt fetching, display, and modal interactions
 */
export const ExpenseReceipt = ({ expenseId, restaurantName }: ExpenseReceiptProps) => {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch receipt URL on component mount
   */
  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const receiptData = await getExpenseReceiptUrl({ data: { expenseId } });
        setReceiptUrl(receiptData.url);
      } catch (_error) {
        setReceiptUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceipt();
  }, [expenseId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5" />
            <span>{m.expense_detail_receipt()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">
              <div className="h-32 bg-muted rounded-lg mb-4" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5" />
            <span>{m.expense_detail_receipt()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receiptUrl ? (
            <div className="space-y-4">
              <div className="max-w-md mx-auto rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="w-full cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img
                    src={receiptUrl}
                    alt={m.expense_detail_receiptImageAlt()}
                    className="w-full"
                  />
                </button>
              </div>
              <div className="flex justify-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <Receipt className="h-4 w-4" />
                  <span>{m.expense_detail_viewFullSize()}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(receiptUrl, '_blank')}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4 rotate-45" />
                  <span>{m.expense_detail_openInNewTab()}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{m.expense_toast_noReceipt()}</p>
              <AdminOnly>
                <p className="text-sm text-muted-foreground mt-1">
                  {m.expense_detail_receiptUploadHint()}
                </p>
              </AdminOnly>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {m.expense_detail_receiptModalTitle({
                restaurant: restaurantName || m.expense_detail_unknownRestaurant(),
              })}
            </DialogTitle>
          </DialogHeader>

          {receiptUrl && (
            <div className="flex justify-center">
              <img
                src={receiptUrl}
                alt={m.expense_detail_receiptImageAlt()}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
