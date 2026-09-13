/**
 * Tests for payment form state reducer
 */

import { describe, expect, it } from 'vitest';
import {
  getInitialPaymentFormState,
  type PaymentFormState,
  paymentFormReducer,
} from '../use-payment-form';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function baseState(overrides?: Partial<PaymentFormState>): PaymentFormState {
  return {
    paymentMode: 'PREPAYMENT',
    date: today(),
    paymentType: 'PAYME',
    editableAmount: '',
    currentColleagueId: '',
    paymentProofFile: null,
    existingPaymentProofUrl: null,
    showExistingProof: false,
    keepExistingProof: true,
    hadExistingProof: false,
    ...overrides,
  };
}

describe('getInitialPaymentFormState', () => {
  it('returns defaults when no values provided', () => {
    const state = getInitialPaymentFormState();
    expect(state.paymentMode).toBe('PREPAYMENT');
    expect(state.date).toBe(today());
    expect(state.paymentType).toBe('PAYME');
    expect(state.editableAmount).toBe('');
    expect(state.currentColleagueId).toBe('');
    expect(state.paymentProofFile).toBe(null);
    expect(state.showExistingProof).toBe(false);
    expect(state.keepExistingProof).toBe(true);
    expect(state.hadExistingProof).toBe(false);
  });

  it('applies provided override values', () => {
    const state = getInitialPaymentFormState({
      paymentMode: 'EXPENSE_PAYMENT',
      editableAmount: '50.00',
      paymentType: 'FPS',
      currentColleagueId: '3',
    });
    expect(state.paymentMode).toBe('EXPENSE_PAYMENT');
    expect(state.editableAmount).toBe('50.00');
    expect(state.paymentType).toBe('FPS');
    expect(state.currentColleagueId).toBe('3');
  });
});

describe('paymentFormReducer', () => {
  it('SET_MODE changes payment mode', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_MODE', mode: 'EXPENSE_PAYMENT' });
    expect(state.paymentMode).toBe('EXPENSE_PAYMENT');
  });

  it('SET_DATE changes the date', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_DATE', date: '2024-06-15' });
    expect(state.date).toBe('2024-06-15');
  });

  it('SET_PAYMENT_TYPE changes the payment method', () => {
    const state = paymentFormReducer(baseState(), {
      type: 'SET_PAYMENT_TYPE',
      paymentType: 'CASH',
    });
    expect(state.paymentType).toBe('CASH');
  });

  it('SET_AMOUNT changes the editable amount', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_AMOUNT', amount: '25.50' });
    expect(state.editableAmount).toBe('25.50');
  });

  it('SET_COLLEAGUE changes the current colleague id', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_COLLEAGUE', colleagueId: '5' });
    expect(state.currentColleagueId).toBe('5');
  });

  it('SET_PAYMENT_PROOF_FILE sets file and resets keepExistingProof', () => {
    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const state = paymentFormReducer(baseState({ keepExistingProof: true }), {
      type: 'SET_PAYMENT_PROOF_FILE',
      file,
    });
    expect(state.paymentProofFile).toBe(file);
    expect(state.keepExistingProof).toBe(false);
  });

  it('SET_PAYMENT_PROOF_FILE with null keeps existing proof', () => {
    const state = paymentFormReducer(baseState(), {
      type: 'SET_PAYMENT_PROOF_FILE',
      file: null,
    });
    expect(state.paymentProofFile).toBe(null);
    expect(state.keepExistingProof).toBe(true);
  });

  it('SET_PAYMENT_PROOF_URL sets the existing proof url', () => {
    const state = paymentFormReducer(baseState(), {
      type: 'SET_PAYMENT_PROOF_URL',
      url: 'https://example.com/proof.png',
    });
    expect(state.existingPaymentProofUrl).toBe('https://example.com/proof.png');
  });

  it('SHOW_EXISTING_PROOF toggles the modal visibility', () => {
    const state = paymentFormReducer(baseState(), { type: 'SHOW_EXISTING_PROOF', show: true });
    expect(state.showExistingProof).toBe(true);
  });

  it('SET_KEEP_EXISTING_PROOF updates the keep flag', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_KEEP_EXISTING_PROOF', keep: false });
    expect(state.keepExistingProof).toBe(false);
  });

  it('SET_HAD_EXISTING_PROOF updates the had flag', () => {
    const state = paymentFormReducer(baseState(), { type: 'SET_HAD_EXISTING_PROOF', had: true });
    expect(state.hadExistingProof).toBe(true);
  });

  it('RESET_FORM returns to initial state', () => {
    const modified = baseState({
      paymentMode: 'EXPENSE_PAYMENT',
      editableAmount: '100',
      paymentType: 'CASH',
      currentColleagueId: '7',
    });
    const state = paymentFormReducer(modified, { type: 'RESET_FORM' });
    const initial = getInitialPaymentFormState();
    expect(state).toEqual(initial);
  });

  it('RESET_FORM can apply new initial values', () => {
    const state = paymentFormReducer(baseState(), {
      type: 'RESET_FORM',
      initialValues: { paymentMode: 'EXPENSE_PAYMENT', editableAmount: '30' },
    });
    expect(state.paymentMode).toBe('EXPENSE_PAYMENT');
    expect(state.editableAmount).toBe('30');
  });
});
