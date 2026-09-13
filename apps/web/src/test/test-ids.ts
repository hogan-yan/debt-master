/**
 * Centralized data-testid constants. Single source of truth —
 * rename a constant here and TypeScript flags every usage.
 */

// ─── Authentication ───────────────────────────────────────────────
export const AUTH = {
  ACCESS_CODE_INPUT: 'access-code-input',
  ADMIN_ACCESS_HEADING: 'admin-access-heading',
  ADMIN_EMAIL_INPUT: 'admin-email-input',
  ADMIN_LOGIN_BTN: 'admin-login-btn',
  ADMIN_LOGIN_ERROR: 'admin-login-error',
  ADMIN_PASSWORD_INPUT: 'admin-password-input',
  ADMIN_TOTP_BACK_BTN: 'admin-totp-back-btn',
  ADMIN_TOTP_INPUT: 'admin-totp-input',
  ADMIN_TOTP_SUBMIT_BTN: 'admin-totp-submit-btn',
  COLLEAGUE_ACCESS_HEADING: 'colleague-access-heading',
  COLLEAGUE_LOGIN_BTN: 'colleague-login-btn',
  FORGOT_PASSWORD_EMAIL_INPUT: 'forgot-password-email-input',
  FORGOT_PASSWORD_HEADING: 'forgot-password-heading',
  FORGOT_PASSWORD_SUBMIT_BTN: 'forgot-password-submit-btn',
  LOGIN_HEADING: 'login-heading',
  RESET_PASSWORD_INPUT: 'reset-password-input',
  RESET_PASSWORD_CONFIRM_INPUT: 'reset-password-confirm-input',
  RESET_PASSWORD_SUBMIT_BTN: 'reset-password-submit-btn',
} as const;

// ─── First-run Setup ─────────────────────────────────────────────
export const SETUP = {
  EMAIL_INPUT: 'setup-email-input',
  HEADING: 'setup-heading',
  NAME_INPUT: 'setup-name-input',
  PASSWORD_INPUT: 'setup-password-input',
  SETUP_TOKEN_INPUT: 'setup-token-input',
  SUBMIT_BTN: 'setup-submit-btn',
} as const;

// ─── Navigation ───────────────────────────────────────────────────
export const NAV = {
  APP_ROOT: 'app-root',
  AUTH: 'auth',
  AUTHENTICATED: 'authenticated',
  BACK_LINK: 'back-link',
  BACK_TO_RESTAURANTS_LINK: 'back-to-restaurants-link',
  COLLEAGUES_LINK: 'colleagues-link',
  DASHBOARD_LINK: 'dashboard-link',
  DESKTOP_NAV_LINKS: 'desktop-nav-links',
  EXPENSES_LINK: 'expenses-link',
  LANGUAGE_SWITCHER_BTN: 'language-switcher-btn',
  LOGIN_BTN: 'login-btn',
  LOGOUT_BTN: 'logout-btn',
  MOBILE_MENU_TOGGLE_BTN: 'mobile-menu-toggle-btn',
  USER_MENU_BTN: 'user-menu-btn',
  USER_MENU_LOGOUT: 'user-menu-logout',
  PAYMENTS_LINK: 'payments-link',
  RESTAURANTS_LINK: 'restaurants-link',
  SETTINGS_LINK: 'settings-link',
  USER: 'user',
  USERNAME: 'username',
} as const;

export function languageMenuitemId(locale: string): string {
  return `language-${locale}-menuitem`;
}

// ─── Dashboard ────────────────────────────────────────────────────
export const DASHBOARD = {
  HEADING: 'dashboard-heading',
  OVERVIEW_TAB: 'overview-tab',
  RESTAURANTS_TAB: 'restaurants-tab',
  SPENDING_TAB: 'spending-tab',
  WHO_OWES_TAB: 'who-owes-tab',
} as const;

// ─── Debtors Tab ──────────────────────────────────────────────────
export const DEBTORS = {
  DEBTOR_DAYS_TEXT: 'debtor-days-text',
  DEBTOR_NAME: 'debtor-name',
  DEBTOR_OWES_AMOUNT: 'debtor-owes-amount',
  DEBTOR_RANK_BADGE: 'debtor-rank-badge',
  DEBTOR_UNPAID_BADGE: 'debtor-unpaid-badge',
  DEBTORS_TAB: 'debtors-tab',
  DEBTORS_TAB_HEADING: 'debtors-tab-heading',
  EVERYONE_PAID_UP_EMPTY: 'everyone-paid-up-empty',
  EXPENSE_COLLEAGUE_AMOUNT: 'expense-colleague-amount',
  EXPENSE_PARTICIPANT_COUNT_BADGE: 'expense-participant-count-badge',
  EXPENSE_REMAINING_AMOUNT: 'expense-remaining-amount',
  EXPENSE_RESTAURANT_NAME: 'expense-restaurant-name',
} as const;

export function debtorCardId(debtorId: number): string {
  return `debtor-card-${debtorId}`;
}

export function debtorExpandToggleId(debtorId: number): string {
  return `debtor-expand-toggle-${debtorId}`;
}

export function claimAllBtnId(debtorId: number): string {
  return `claim-all-${debtorId}-btn`;
}

export function unpaidExpensesHeadingId(debtorId: number): string {
  return `unpaid-expenses-heading-${debtorId}`;
}

export function unpaidExpensesDesktopId(debtorId: number): string {
  return `unpaid-expenses-desktop-${debtorId}`;
}

export function unpaidExpenseId(debtorId: number, expenseId: number): string {
  return `unpaid-expense-${debtorId}-${expenseId}`;
}

export function unpaidExpenseDesktopId(debtorId: number, expenseId: number): string {
  return `unpaid-expense-desktop-${debtorId}-${expenseId}`;
}

// ─── Colleague Detail ─────────────────────────────────────────────
export const COLLEAGUE_DETAIL = {
  ACTIVE_TAB: 'active-tab',
  ACTIVITY_SEARCH_INPUT: 'activity-search-input',
  ALL_FILTER_BTN: 'all-filter-btn',
  COLLEAGUE_NAME_TEXT: 'colleague-name-text',
  DEACTIVATE_COLLEAGUE_MENUITEM: 'deactivate-colleague-menuitem',
  DEACTIVATE_CONFIRM_DIALOG: 'deactivate-confirm-dialog',
  DEBT_AGE_KPI: 'debt-age-kpi',
  EDIT_NAME_BTN: 'edit-name-btn',
  EDIT_NAME_INPUT: 'edit-name-input',
  EXPENSE_DETAIL_SECTION: 'expense-detail-section',
  EXPENSE_FILTER_BTN: 'expense-filter-btn',
  INACTIVE_TAB: 'inactive-tab',
  INACTIVE_BADGE: 'inactive-badge',
  LAST_ACTIVITY_KPI: 'last-activity-kpi',
  MORE_ACTIONS_BTN: 'more-actions-btn',
  NET_BALANCE_KPI: 'net-balance-kpi',
  PAYMENT_DIALOG: 'payment-dialog',
  PAYMENT_FILTER_BTN: 'payment-filter-btn',
  PAYMENT_RATIO_KPI: 'payment-ratio-kpi',
  RECORD_PAYMENT_EMPTY_BTN: 'record-payment-empty-btn',
  RECORD_PAYMENT_HEADER_BTN: 'record-payment-header-btn',
  SAVE_BTN: 'save-btn',
  DEACTIVATE_BTN: 'deactivate-btn',
} as const;

export function activityTabId(tabId: string): string {
  return `${tabId}-tab`;
}

export function transactionAmountId(transactionId: number): string {
  return `transaction-amount-${transactionId}`;
}

// ─── Expense ──────────────────────────────────────────────────────
export const EXPENSE = {
  ADD_EXPENSE_BTN: 'add-expense-btn',
  ADD_EXPENSE_DIALOG: 'add-expense-dialog',
  AMOUNT_COL: 'amount-col',
  DELETE_EXPENSE_BTN: 'delete-expense-btn',
  DELETE_EXPENSE_MENUITEM: 'delete-expense-menuitem',
  DUPLICATE_EXPENSE_BTN: 'duplicate-expense-btn',
  DUPLICATE_EXPENSE_MENUITEM: 'duplicate-expense-menuitem',
  EDIT_EXPENSE_BTN: 'edit-expense-btn',
  EDIT_EXPENSE_DIALOG: 'edit-expense-dialog',
  EDIT_EXPENSE_MENUITEM: 'edit-expense-menuitem',
  EXPENSE_MOBILE_LIST: 'expense-mobile-list',
  EXPENSE_TABLE: 'expense-table',
  EXPENSE_TABLE_ROW: 'expense-table-row',
  MANAGEMENT_HEADING: 'expense-management-heading',
  RECEIPT_BTN: 'receipt-btn',
  RECEIPT_MODAL: 'receipt-modal',
  RECEIPT_MODAL_IMAGE: 'receipt-modal-image',
  SEARCH_EXPENSES_INPUT: 'search-expenses-input',
  STATUS_COL: 'status-col',
} as const;

export function expenseDetailLinkId(expenseId: number): string {
  return `expense-detail-link-${expenseId}`;
}

// ─── Expense Form ─────────────────────────────────────────────────
export const EXPENSE_FORM = {
  ADD_ITEM_BTN: 'add-item-btn',
  AMOUNT_INPUT: 'amount-input',
  CANCEL_BTN: 'cancel-btn',
  CREATE_EXPENSE_BTN: 'create-expense-btn',
  DATE_INPUT: 'date-input',
  EQUAL_RADIO: 'equal-radio',
  INLINE_COLLEAGUE_ADD_BTN: 'inline-colleague-add-btn',
  INLINE_COLLEAGUE_NAME_INPUT: 'inline-colleague-name-input',
  ITEM_NAME_INPUT: 'item-name-input',
  ITEM_PRICE_INPUT: 'item-price-input',
  ITEMIZED_RADIO: 'itemized-radio',
  RECEIPT_UPLOAD_INPUT: 'receipt-upload-input',
  RESTAURANT_SELECT_BTN: 'restaurant-select-btn',
  UPDATE_EXPENSE_BTN: 'update-expense-btn',
} as const;

export function participantCheckboxId(colleagueId: number): string {
  return `participant-checkbox-${colleagueId}`;
}

// ─── Payment ──────────────────────────────────────────────────────
export const PAYMENT = {
  ADD_PAYMENT_BTN: 'add-payment-btn',
  COLLEAGUE_SELECT: 'colleague-select',
  DELETE_PAYMENT_MENUITEM: 'delete-payment-menuitem',
  EXPENSE_PAYMENT_MODE_BTN: 'expense-payment-mode-btn',
  PREPAYMENT_MODE_BTN: 'prepayment-mode-btn',
  RECORD_PAYMENT_DIALOG: 'record-payment-dialog',
  SUBMIT_PAYMENT_BTN: 'submit-payment-btn',
  TRACKING_HEADING: 'payment-tracking-heading',
} as const;

// ─── Payment Form ─────────────────────────────────────────────────
export const PAYMENT_FORM = {
  AMOUNT_INPUT: 'amount-input',
  CANCEL_BTN: 'cancel-btn',
  DATE_INPUT: 'date-input',
} as const;

// ─── Payment Claim ────────────────────────────────────────────────
export const PAYMENT_CLAIM = {
  DIALOG: 'payment-claim-dialog',
  PAYMENT_METHOD_SELECT: 'payment-method-select',
  PAYMENT_PROOF_INPUT: 'payment-proof-input',
  SUBMIT_BTN: 'payment-claim-submit-btn',
} as const;

// ─── Bulk Claim ───────────────────────────────────────────────────
export const BULK_CLAIM = {
  CONFIRM_BTN: 'confirm-btn',
  DESCRIPTION: 'bulk-claim-description',
  DIALOG: 'bulk-claim-dialog',
  EXPENSES_LIST: 'bulk-claim-expenses-list',
  PAYMENT_TYPE_INPUT: 'bulk-claim-payment-type-input',
} as const;

export function bulkClaimExpenseId(expenseId: number): string {
  return `bulk-claim-expense-${expenseId}`;
}

// ─── Restaurant ───────────────────────────────────────────────────
export const RESTAURANT = {
  ADD_RESTAURANT_BTN: 'add-restaurant-btn',
  ADD_RESTAURANT_DIALOG: 'add-restaurant-dialog',
  CUISINE_BADGE: 'cuisine-badge',
  CUISINE_COL: 'cuisine-col',
  DELETE_BTN: 'delete-btn',
  DETAILS_HEADING: 'restaurant-details-heading',
  EDIT_BTN: 'edit-btn',
  EDIT_RESTAURANT_DIALOG: 'edit-restaurant-dialog',
  EDIT_RESTAURANT_MENUITEM: 'edit-restaurant-menuitem',
  MANAGEMENT_HEADING: 'restaurant-management-heading',
  RESTAURANT_ADDRESS_TEXT: 'restaurant-address-text',
  RESTAURANT_COL: 'restaurant-col',
  RESTAURANT_NAME_TEXT: 'restaurant-name-text',
  RESTAURANT_NOTES_TEXT: 'restaurant-notes-text',
  RESTAURANT_TABLE_ROW: 'restaurant-table-row',
  SAVE_CHANGES_BTN: 'save-changes-btn',
  SEARCH_RESTAURANTS_INPUT: 'search-restaurants-input',
  VIEW_DETAILS_MENUITEM: 'view-details-menuitem',
} as const;

// ─── Restaurant Form ──────────────────────────────────────────────
export const RESTAURANT_FORM = {
  ADDRESS_INPUT: 'address-input',
  CUISINE_INPUT: 'cuisine-input',
  NAME_INPUT: 'name-input',
  NOTES_INPUT: 'notes-input',
} as const;

// ─── Restaurant Detail ────────────────────────────────────────────
export const RESTAURANT_DETAIL = {
  DETAIL_CUISINE_INPUT: 'detail-cuisine-input',
  DETAIL_NOTES_INPUT: 'detail-notes-input',
  DETAIL_RESTAURANT_NAME_INPUT: 'detail-restaurant-name-input',
  RECENT_EXPENSES_HEADING: 'recent-expenses-heading',
  TOTAL_AMOUNT_SPENT_KPI: 'total-amount-spent-kpi',
  TOTAL_EXPENSES_KPI: 'total-expenses-kpi',
} as const;

// ─── Colleague ────────────────────────────────────────────────────
export const COLLEAGUE = {
  ADD_COLLEAGUE_BTN: 'add-colleague-btn',
  COLLEAGUE_TABLE_ROW: 'colleague-row',
  MANAGEMENT_HEADING: 'colleague-management-heading',
} as const;

// ─── Colleague Form ───────────────────────────────────────────────
export const COLLEAGUE_FORM = {
  ADD_BTN: 'add-colleague-btn',
  NAME_INPUT: 'name-input',
} as const;

// ─── Table Columns ────────────────────────────────────────────────
export const TABLE_COL = {
  ACTIONS_COL: 'actions-col',
  AMOUNT_COL: 'amount-col',
  CUISINE_COL: 'cuisine-col',
  DETAILS_COL: 'details-col',
  PARTICIPANTS_COL: 'participants-col',
  RESTAURANT_COL: 'restaurant-col',
  ROW_ACTIONS_BTN: 'row-actions-btn',
  STATUS_COL: 'status-col',
} as const;

// ─── Inactive Colleague Columns ───────────────────────────────────
export const INACTIVE_COLLEAGUE = {
  DELETE_PERMANENTLY_MENUITEM: 'delete-permanently-menuitem',
  RESTORE_COLLEAGUE_MENUITEM: 'restore-colleague-menuitem',
} as const;

// ─── Settings Security Panel ──────────────────────────────────────
export const SECURITY = {
  PANEL: 'security-panel',
  CHANGE_PASSWORD_FORM: 'change-password-form',
  CURRENT_PASSWORD_INPUT: 'current-password-input',
  NEW_PASSWORD_INPUT: 'new-password-input',
  CONFIRM_PASSWORD_INPUT: 'confirm-password-input',
  CHANGE_PASSWORD_SUBMIT_BTN: 'change-password-submit-btn',
  SESSIONS_LIST: 'sessions-list',
  SESSION_ITEM: 'session-item',
  REVOKE_SESSION_BTN: 'revoke-session-btn',
  AUDIT_LOG_SECTION: 'audit-log-section',
  AUDIT_LOG_LOADING: 'audit-log-loading',
  AUDIT_LOG_ERROR: 'audit-log-error',
  AUDIT_LOG_EMPTY: 'audit-log-empty',
  AUDIT_LOG_LIST: 'audit-log-list',
  AUDIT_LOG_ITEM: 'audit-log-item',
  AUDIT_LOG_LOAD_MORE_BTN: 'audit-log-load-more-btn',
} as const;

// ─── Settings Two-Factor Setup ────────────────────────────────────
export const TWO_FACTOR = {
  SECTION: 'two-factor-section',
  STATUS_ENABLED: 'two-factor-status-enabled',
  STATUS_DISABLED: 'two-factor-status-disabled',
  ENABLE_PASSWORD_INPUT: 'two-factor-enable-password-input',
  ENABLE_BTN: 'two-factor-enable-btn',
  QR_CODE: 'two-factor-qr-code',
  BACKUP_CODES: 'two-factor-backup-codes',
  VERIFY_CODE_INPUT: 'two-factor-verify-code-input',
  VERIFY_BTN: 'two-factor-verify-btn',
  DISABLE_PASSWORD_INPUT: 'two-factor-disable-password-input',
  DISABLE_BTN: 'two-factor-disable-btn',
} as const;

// ─── Common / Shared ──────────────────────────────────────────────
export const COMMON = {
  CANCEL_BTN: 'cancel-btn',
  CONFIRM_BTN: 'confirm-btn',
  GUARD_CONTENT: 'guard-content',
  LOADING: 'loading',
  SEARCH_BTN: 'search-btn',
} as const;

// ─── Route Protection / Auth ──────────────────────────────────────
export const AUTH_GUARD = {
  ADMIN: 'admin',
  CAN_DELETE: 'can-delete',
  CAN_VIEW: 'can-view',
} as const;
