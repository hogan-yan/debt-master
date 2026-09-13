/**
 * DateBadge - A beautiful chip/badge component for displaying dates
 * Shows relative time with color coding and full date in tooltip
 */

import { Calendar, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getDateBadgeInfo } from '@/utils/formatters';

interface DateBadgeProps {
  dateString: string | undefined;
  className?: string | undefined;
}

/**
 * DateWithBadge - Shows actual date with a small relative time badge
 * Example: "May 30" with small "Today" badge next to it
 */
export function DateWithBadge({ dateString, className = '' }: DateBadgeProps) {
  if (!dateString) {
    return <span className={className}>-</span>;
  }
  const dateInfo = getDateBadgeInfo(dateString);

  // Format the main date display
  const date = new Date(dateString);
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  const mainDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(dateYear !== currentYear && { year: 'numeric' }),
  }).format(date);

  // Get badge text
  const badgeText = dateInfo.variant === 'thisWeek' ? dateInfo.actualDate : dateInfo.relativeText;

  // Don't show badge if it's the same as the main date or if it would show the actual date
  const shouldShowBadge =
    Boolean(badgeText) &&
    badgeText !== mainDate &&
    !badgeText.includes(String(mainDate.split(',')[0]));

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      {/* Main date display */}
      <span className="font-medium text-foreground">{mainDate}</span>

      {/* Small relative time badge */}
      {shouldShowBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-muted/50 text-muted-foreground text-xs font-medium">
                {badgeText}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-center">
                <div className="font-medium">{mainDate}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {dateInfo.variant === 'thisWeek'
                    ? `${dateInfo.relativeText} (${dateInfo.actualDate})`
                    : dateInfo.relativeText}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Compact version for table cells
 */
export function CompactDateWithBadge({ dateString, className = '' }: DateBadgeProps) {
  if (!dateString) {
    return <span className={className}>-</span>;
  }
  const dateInfo = getDateBadgeInfo(dateString);

  const date = new Date(dateString);
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  const mainDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(dateYear !== currentYear && { year: 'numeric' }),
  }).format(date);

  // Get badge text
  const badgeText = dateInfo.variant === 'thisWeek' ? dateInfo.actualDate : dateInfo.relativeText;

  // Don't show badge if it's the same as the main date or if it would show the actual date
  const shouldShowBadge =
    Boolean(badgeText) &&
    badgeText !== mainDate &&
    !badgeText.includes(String(mainDate.split(',')[0]));

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      <span className="whitespace-nowrap font-medium text-foreground text-sm">{mainDate}</span>

      {shouldShowBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-muted/50 text-muted-foreground text-xs font-medium">
                {badgeText}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-center">
                <div className="font-medium">{mainDate}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {dateInfo.variant === 'thisWeek'
                    ? `${dateInfo.relativeText} (${dateInfo.actualDate})`
                    : dateInfo.relativeText}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export function DateBadge({ dateString, className = '' }: DateBadgeProps) {
  if (!dateString) {
    return <span className={className}>-</span>;
  }
  const dateInfo = getDateBadgeInfo(dateString);

  const IconComponent = dateInfo.icon === 'Clock' ? Clock : Calendar;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 text-muted-foreground border text-xs font-medium shadow-sm hover:shadow-md transition duration-200 cursor-default ${className}`}
          >
            <IconComponent className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">{dateInfo.relativeText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover text-popover-foreground">
          <div className="flex flex-col space-y-1">
            <span className="font-medium">{dateInfo.actualDate}</span>
            {dateInfo.actualDate !== dateInfo.relativeText && (
              <span className="text-xs text-muted-foreground">{dateInfo.relativeText}</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version of DateBadge for table cells
 */
export function CompactDateBadge({ dateString, className = '' }: DateBadgeProps) {
  if (!dateString) {
    return <span className={className}>-</span>;
  }
  const dateInfo = getDateBadgeInfo(dateString);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center justify-center px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground border text-xs font-medium cursor-default hover:shadow-sm transition duration-150 ${className}`}
          >
            <span className="whitespace-nowrap">{dateInfo.relativeText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-center">
            <div className="font-medium">{dateInfo.actualDate}</div>
            {dateInfo.actualDate !== dateInfo.relativeText && (
              <div className="text-xs text-muted-foreground mt-1">{dateInfo.relativeText}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
