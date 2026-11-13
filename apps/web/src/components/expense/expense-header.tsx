import { Link } from '@tanstack/react-router';
import { ArrowLeft, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

interface ExpenseHeaderProps {
  /** Expense restaurant name for sharing */
  restaurantName?: string | undefined;
  /** Total expense amount for sharing */
  amount: number;
  /** Number of participants for sharing */
  participantCount: number;
  /** Expense date for sharing */
  date?: Date | string | undefined;
}

/**
 * Header component for expense detail page
 * Provides navigation back to expenses and sharing functionality
 */
export const ExpenseHeader = ({
  restaurantName,
  amount,
  participantCount: _participantCount,
  date,
}: ExpenseHeaderProps) => {
  /**
   * Copy current page URL to clipboard
   */
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(m.expense_detail_linkCopied());
    } catch {
      toast.error(m.expense_detail_copyLinkFailed());
    }
  };

  /**
   * Format date for sharing
   */
  const formatShareDate = (date?: Date | string): string => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(getLocale(), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * Share expense details using Web Share API or fallback to copy link
   */
  const handleShare = async () => {
    const formattedDate = formatShareDate(date);
    const restaurant = restaurantName || m.expense_detail_unknownRestaurant();

    // Create concise share text with URL at end
    const shareText = [
      formattedDate?.trim(),
      m.expense_detail_shareTotal({ amount: `$${amount.toFixed(2)}` }),
      window.location.href,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    const shareData = {
      title: m.expense_detail_shareTitle({ restaurant }),
      text: shareText,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled sharing or sharing failed
        handleCopyLink();
      }
    } else {
      // Fallback to copying link
      handleCopyLink();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Link
          to="/expenses/"
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {m.expense_detail_backToExpenses()}
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="flex items-center space-x-2"
        >
          <Share2 className="h-4 w-4" />
          <span>{m.expense_detail_share()}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center space-x-2"
        >
          <Copy className="h-4 w-4" />
          <span>{m.expense_detail_copyLink()}</span>
        </Button>
      </div>
    </div>
  );
};
