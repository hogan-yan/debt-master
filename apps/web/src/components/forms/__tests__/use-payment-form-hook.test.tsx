/**
 * Tests for usePaymentForm hook
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePaymentForm } from '../use-payment-form-hook';

describe('usePaymentForm', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => usePaymentForm());
    expect(result.current.state.paymentMode).toBe('PREPAYMENT');
    expect(result.current.state.paymentType).toBe('PAYME');
    expect(result.current.state.editableAmount).toBe('');
    expect(result.current.state.currentColleagueId).toBe('');
    expect(result.current.state.showExistingProof).toBe(false);
    expect(result.current.state.keepExistingProof).toBe(true);
  });

  it('initializes with provided values', () => {
    const { result } = renderHook(() =>
      usePaymentForm({ paymentMode: 'EXPENSE_PAYMENT', editableAmount: '50' })
    );
    expect(result.current.state.paymentMode).toBe('EXPENSE_PAYMENT');
    expect(result.current.state.editableAmount).toBe('50');
  });

  it('setMode updates the payment mode', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setMode('EXPENSE_PAYMENT'));
    expect(result.current.state.paymentMode).toBe('EXPENSE_PAYMENT');
  });

  it('setDate updates the date', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setDate('2024-12-25'));
    expect(result.current.state.date).toBe('2024-12-25');
  });

  it('setPaymentType updates the payment type', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setPaymentType('CASH'));
    expect(result.current.state.paymentType).toBe('CASH');
  });

  it('setAmount updates the editable amount', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setAmount('100.50'));
    expect(result.current.state.editableAmount).toBe('100.50');
  });

  it('setColleague updates the current colleague id', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setColleague('3'));
    expect(result.current.state.currentColleagueId).toBe('3');
  });

  it('setPaymentProofFile updates the file', () => {
    const { result } = renderHook(() => usePaymentForm());
    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    act(() => result.current.setPaymentProofFile(file));
    expect(result.current.state.paymentProofFile).toBe(file);
    expect(result.current.state.keepExistingProof).toBe(false);
  });

  it('setPaymentProofUrl updates the url', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setPaymentProofUrl('https://example.com/proof.png'));
    expect(result.current.state.existingPaymentProofUrl).toBe('https://example.com/proof.png');
  });

  it('setShowExistingProof updates showExistingProof', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setShowExistingProof(true));
    expect(result.current.state.showExistingProof).toBe(true);
  });

  it('setKeepExistingProof updates keepExistingProof', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setKeepExistingProof(false));
    expect(result.current.state.keepExistingProof).toBe(false);
  });

  it('setHadExistingProof updates hadExistingProof', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => result.current.setHadExistingProof(true));
    expect(result.current.state.hadExistingProof).toBe(true);
  });

  it('resetForm restores initial state', () => {
    const { result } = renderHook(() => usePaymentForm());
    act(() => {
      result.current.setMode('EXPENSE_PAYMENT');
      result.current.setAmount('50');
      result.current.setColleague('7');
      result.current.resetForm();
    });
    expect(result.current.state.paymentMode).toBe('PREPAYMENT');
    expect(result.current.state.editableAmount).toBe('');
    expect(result.current.state.currentColleagueId).toBe('');
  });
});
