/**
 * Payment form state reducer
 * Manages form field state for payment recording (both prepayment and expense payment modes)
 */

export type PaymentMode = 'PREPAYMENT' | 'EXPENSE_PAYMENT';
export type PaymentMethod = 'PAYME' | 'FPS' | 'CASH' | 'OTHER';

export interface PaymentFormState {
  paymentMode: PaymentMode;
  date: string;
  paymentType: PaymentMethod;
  editableAmount: string;
  currentColleagueId: string;
  paymentProofFile: File | null;
  existingPaymentProofUrl: string | null;
  showExistingProof: boolean;
  keepExistingProof: boolean;
  hadExistingProof: boolean;
}

type PaymentFormAction =
  | { type: 'SET_MODE'; mode: PaymentMode }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_PAYMENT_TYPE'; paymentType: PaymentMethod }
  | { type: 'SET_AMOUNT'; amount: string }
  | { type: 'SET_COLLEAGUE'; colleagueId: string }
  | { type: 'SET_PAYMENT_PROOF_FILE'; file: File | null }
  | { type: 'SET_PAYMENT_PROOF_URL'; url: string | null }
  | { type: 'SHOW_EXISTING_PROOF'; show: boolean }
  | { type: 'SET_KEEP_EXISTING_PROOF'; keep: boolean }
  | { type: 'SET_HAD_EXISTING_PROOF'; had: boolean }
  | { type: 'RESET_FORM'; initialValues?: Partial<PaymentFormState> | undefined };

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getInitialPaymentFormState(
  initialValues?: Partial<PaymentFormState>
): PaymentFormState {
  const paymentMode = initialValues?.paymentMode ?? 'PREPAYMENT';
  const date: string =
    initialValues == null || initialValues.date === undefined
      ? getTodayDate()
      : String(initialValues.date);
  return {
    paymentMode,
    date,
    paymentType: initialValues?.paymentType ?? 'PAYME',
    editableAmount: initialValues?.editableAmount ?? '',
    currentColleagueId: initialValues?.currentColleagueId ?? '',
    paymentProofFile: null,
    existingPaymentProofUrl: initialValues?.existingPaymentProofUrl ?? null,
    showExistingProof: false,
    keepExistingProof: initialValues?.keepExistingProof ?? true,
    hadExistingProof: initialValues?.hadExistingProof ?? false,
  };
}

export function paymentFormReducer(
  state: PaymentFormState,
  action: PaymentFormAction
): PaymentFormState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, paymentMode: action.mode };
    case 'SET_DATE':
      return { ...state, date: action.date };
    case 'SET_PAYMENT_TYPE':
      return { ...state, paymentType: action.paymentType };
    case 'SET_AMOUNT':
      return { ...state, editableAmount: action.amount };
    case 'SET_COLLEAGUE':
      return { ...state, currentColleagueId: action.colleagueId };
    case 'SET_PAYMENT_PROOF_FILE':
      return { ...state, paymentProofFile: action.file, keepExistingProof: action.file === null };
    case 'SET_PAYMENT_PROOF_URL':
      return { ...state, existingPaymentProofUrl: action.url };
    case 'SHOW_EXISTING_PROOF':
      return { ...state, showExistingProof: action.show };
    case 'SET_KEEP_EXISTING_PROOF':
      return { ...state, keepExistingProof: action.keep };
    case 'SET_HAD_EXISTING_PROOF':
      return { ...state, hadExistingProof: action.had };
    case 'RESET_FORM':
      return getInitialPaymentFormState(action.initialValues);
  }
}
