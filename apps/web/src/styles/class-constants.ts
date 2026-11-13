/**
 * Shared Tailwind CSS class constants for consistent styling across the application.
 * Centralizes commonly repeated class patterns to improve maintainability.
 */

// Layout & Grid Constants
export const LAYOUT_CLASSES = {
  // Grid layouts
  SUMMARY_GRID: 'grid grid-cols-2 md:grid-cols-4 gap-6',
  CARD_GRID_2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  MOBILE_CARD_GRID: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',

  // Flex layouts
  FLEX_BETWEEN: 'flex justify-between items-center',
  FLEX_START: 'flex justify-start items-center',
  FLEX_END: 'flex justify-end items-center',
  FLEX_CENTER: 'flex justify-center items-center',
  FLEX_COLUMN: 'flex flex-col',

  // Common spacing
  SPACE_Y_6: 'space-y-6',
  SPACE_Y_4: 'space-y-4',
  SPACE_Y_3: 'space-y-3',
  SPACE_Y_2: 'space-y-2',
  SPACE_X_4: 'space-x-4',
  SPACE_X_3: 'space-x-3',
  SPACE_X_2: 'space-x-2',
} as const;

// Typography Constants
export const TYPOGRAPHY_CLASSES = {
  // Headings
  PAGE_TITLE: 'text-2xl font-semibold text-foreground',
  SECTION_TITLE: 'text-lg font-medium text-foreground',
  CARD_TITLE: 'text-sm font-medium',

  // Values and statistics
  STAT_VALUE: 'text-xl sm:text-2xl font-bold',
  CURRENCY_VALUE: 'text-2xl font-bold text-foreground',
  POSITIVE_VALUE: 'text-success',
  NEGATIVE_VALUE: 'text-destructive-text',
  NEUTRAL_VALUE: 'text-muted-foreground',

  // Body text
  SUBTITLE: 'text-muted-foreground mt-1',
  DESCRIPTION: 'text-xs text-muted-foreground',
  BODY_TEXT: 'text-foreground',
  SMALL_TEXT: 'text-sm text-muted-foreground',
  MUTED_TEXT: 'text-muted-foreground',
} as const;

// Component State Classes
export const STATE_CLASSES = {
  // Loading states
  LOADING_SPINNER: 'animate-spin rounded-full h-8 w-8 border-b-2 border-foreground',
  LOADING_OVERLAY:
    'absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50',

  // Interactive states
  HOVER_SHADOW: 'shadow-sm hover:shadow-md transition-shadow',
  HOVER_CARD: 'hover:bg-accent',
  FOCUS_RING: 'focus:outline-none focus:ring-ring focus:border-ring',

  // Disabled states
  DISABLED: 'opacity-50 cursor-not-allowed',

  // Animation
  PULSE: 'animate-pulse bg-muted rounded',
} as const;

// Card & Container Classes
export const CONTAINER_CLASSES = {
  // Card styles
  CARD_BASE: 'w-full shadow-sm hover:shadow-md transition-shadow',
  CARD_CONTENT_PADDING: 'p-4',
  CARD_CONTENT_COMPACT: 'p-3',
  CARD_HEADER_PADDING: 'flex flex-row items-center justify-between space-y-0 pb-2',

  // Modal styles
  MODAL_CONTENT: 'max-h-[90vh] overflow-y-auto',
  MODAL_OVERLAY: 'fixed inset-0 bg-background/80 flex items-center justify-center z-50',

  // Form containers
  FORM_SECTION: 'space-y-4',
  FORM_GRID: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  FORM_ACTIONS: 'flex justify-end space-x-2 pt-4 border-t border-border',
} as const;

// Badge & Status Classes
export const BADGE_CLASSES = {
  // Payment status badges
  STATUS_PAID: 'bg-success/10 text-success border border-success/20',
  STATUS_PENDING: 'bg-destructive/5 text-destructive-text border border-destructive/20',
  STATUS_APPROVED: 'bg-success/10 text-success',
  STATUS_REJECTED: 'bg-destructive/10 text-destructive-text',

  // Payment type badges
  PAYMENT_CASH: 'bg-success/10 text-success',
  PAYMENT_BANK: 'bg-info/10 text-info',
  PAYMENT_DIGITAL: 'bg-muted text-muted-foreground',

  // General badge styles
  BADGE_BASE: 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full', // unslop-ignore: status pill
  BADGE_SMALL: 'px-2 py-1 text-xs font-medium rounded-full', // unslop-ignore: status pill
} as const;

// Size Classes
export const SIZE_CLASSES = {
  // Avatar sizes
  AVATAR_XS: 'h-5 w-5 text-xs',
  AVATAR_SM: 'h-6 w-6 text-sm',
  AVATAR_MD: 'h-8 w-8 text-sm',
  AVATAR_LG: 'h-10 w-10 text-base',

  // Icon sizes
  ICON_XS: 'h-3 w-3',
  ICON_SM: 'h-4 w-4',
  ICON_MD: 'h-5 w-5',
  ICON_LG: 'h-6 w-6',

  // Button sizes
  BUTTON_SM: 'h-8 w-8 p-0',
  BUTTON_TOUCH: 'h-10 w-10 p-0',
  BUTTON_MD: 'px-4 py-2',
  BUTTON_LG: 'px-6 py-3',
} as const;

// Color Classes
export const COLOR_CLASSES = {
  // Background colors
  BG_SUCCESS: 'bg-success/5 border border-success/20',
  BG_ERROR: 'bg-destructive/5 border border-destructive/20',
  BG_WARNING: 'bg-warning/5 border border-warning/20',
  BG_INFO: 'bg-info/5 border border-info/20',

  // Text colors
  TEXT_SUCCESS: 'text-success',
  TEXT_ERROR: 'text-destructive-text',
  TEXT_WARNING: 'text-warning',
  TEXT_INFO: 'text-info',

  // Border colors
  BORDER_SUCCESS: 'border-success',
  BORDER_ERROR: 'border-destructive',
  BORDER_WARNING: 'border-warning/20',
  BORDER_INFO: 'border-info/20',
} as const;

// Responsive Classes
export const RESPONSIVE_CLASSES = {
  // Breakpoint visibility
  HIDE_MOBILE: 'hidden md:block',
  HIDE_DESKTOP: 'block md:hidden',
  MOBILE_ONLY: 'md:hidden',
  DESKTOP_ONLY: 'hidden md:block',

  // Responsive text sizes
  RESPONSIVE_TEXT_SM: 'text-sm md:text-base',
  RESPONSIVE_TEXT_MD: 'text-base md:text-lg',
  RESPONSIVE_TEXT_LG: 'text-lg md:text-xl',

  // Responsive padding/margin
  RESPONSIVE_PADDING: 'p-4 md:p-6',
  RESPONSIVE_MARGIN: 'm-4 md:m-6',
} as const;

// Utility function to get status color classes
export function getStatusColorClasses(status: 'success' | 'error' | 'warning' | 'info') {
  const colorMap = {
    success: {
      bg: COLOR_CLASSES.BG_SUCCESS,
      text: COLOR_CLASSES.TEXT_SUCCESS,
      border: COLOR_CLASSES.BORDER_SUCCESS,
    },
    error: {
      bg: COLOR_CLASSES.BG_ERROR,
      text: COLOR_CLASSES.TEXT_ERROR,
      border: COLOR_CLASSES.BORDER_ERROR,
    },
    warning: {
      bg: COLOR_CLASSES.BG_WARNING,
      text: COLOR_CLASSES.TEXT_WARNING,
      border: COLOR_CLASSES.BORDER_WARNING,
    },
    info: {
      bg: COLOR_CLASSES.BG_INFO,
      text: COLOR_CLASSES.TEXT_INFO,
      border: COLOR_CLASSES.BORDER_INFO,
    },
  };

  return colorMap[status];
}
