/**
 * Payment form hook using reducer
 * Wraps paymentFormReducer with useReducer + dispatch helpers
 */

import { useReducer } from 'react';
import {
  getInitialPaymentFormState,
  type PaymentFormState,
  PaymentMode,
  paymentFormReducer,
} from './use-payment-form';

export function usePaymentForm(initialValues?: Partial<PaymentFormState>) {
  const [state, dispatch] = useReducer(
    paymentFormReducer,
    initialValues,
    (init?: Partial<PaymentFormState> | undefined) => getInitialPaymentFormState(init)
  );

  return {
    state,
    setMode: (mode: PaymentMode) => dispatch({ type: 'SET_MODE', mode }),
    setDate: (date: string) => dispatch({ type: 'SET_DATE', date }),
    setPaymentType: (paymentType: PaymentFormState['paymentType']) =>
      dispatch({ type: 'SET_PAYMENT_TYPE', paymentType }),
    setAmount: (amount: string) => dispatch({ type: 'SET_AMOUNT', amount }),
    setColleague: (colleagueId: string) => dispatch({ type: 'SET_COLLEAGUE', colleagueId }),
    setPaymentProofFile: (file: File | null) => dispatch({ type: 'SET_PAYMENT_PROOF_FILE', file }),
    setPaymentProofUrl: (url: string | null) => dispatch({ type: 'SET_PAYMENT_PROOF_URL', url }),
    setShowExistingProof: (show: boolean) => dispatch({ type: 'SHOW_EXISTING_PROOF', show }),
    setKeepExistingProof: (keep: boolean) => dispatch({ type: 'SET_KEEP_EXISTING_PROOF', keep }),
    setHadExistingProof: (had: boolean) => dispatch({ type: 'SET_HAD_EXISTING_PROOF', had }),
    resetForm: (newValues?: Partial<PaymentFormState>) =>
      dispatch({ type: 'RESET_FORM', initialValues: newValues }),
  };
}
