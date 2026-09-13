import { describe, expect, it, vi } from 'vitest';
import {
  applyStringPreview,
  captureFocusElement,
  firstSelectedFile,
  notificationActionValue,
  registerFormDebug,
  resetFileInputValue,
  runUnlessProcessing,
  shouldBlockPaymentSubmit,
  stringReaderResult,
  withSelectedFile,
} from '../payment-form-guards';
import {
  retryTurnstileWidget,
  turnstileErrorMessage,
  wireExistingTurnstileScript,
} from '../turnstile-widget';

describe('payment-form-guards', () => {
  it('firstSelectedFile reads the first file or undefined', () => {
    expect(firstSelectedFile(undefined)).toBeUndefined();
    expect(firstSelectedFile(null)).toBeUndefined();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const list = { 0: file, length: 1, item: () => file } as unknown as FileList;
    expect(firstSelectedFile(list)).toBe(file);
  });

  it('withSelectedFile invokes handler only when a file exists', () => {
    const onFile = vi.fn();
    withSelectedFile(null, onFile);
    expect(onFile).not.toHaveBeenCalled();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const list = { 0: file, length: 1, item: () => file } as unknown as FileList;
    withSelectedFile(list, onFile);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('resetFileInputValue clears an input when present', () => {
    const input = document.createElement('input');
    input.id = 'proof-upload-test';
    input.value = 'C:\\fake.png';
    document.body.appendChild(input);
    resetFileInputValue('proof-upload-test');
    expect(input.value).toBe('');
    input.remove();
  });

  it('resetFileInputValue ignores missing elements', () => {
    expect(() => resetFileInputValue('missing-input')).not.toThrow();
  });

  it('shouldBlockPaymentSubmit mirrors processing flag', () => {
    expect(shouldBlockPaymentSubmit(true)).toBe(true);
    expect(shouldBlockPaymentSubmit(false)).toBe(false);
  });

  it('runUnlessProcessing skips when processing', async () => {
    const run = vi.fn(async () => {});
    await runUnlessProcessing(true, run);
    expect(run).not.toHaveBeenCalled();
    await runUnlessProcessing(false, run);
    expect(run).toHaveBeenCalledOnce();
  });

  it('captureFocusElement only keeps HTMLElements', () => {
    const button = document.createElement('button');
    expect(captureFocusElement(button)).toBe(button);
    expect(captureFocusElement(null)).toBeNull();
  });

  it('registerFormDebug stores when element exists', () => {
    const map = new WeakMap<HTMLFormElement, unknown>();
    const form = document.createElement('form');
    registerFormDebug(form, { id: 1 }, map);
    expect(map.get(form)).toEqual({ id: 1 });
    registerFormDebug(null, { id: 2 }, map);
    expect(map.get(form)).toEqual({ id: 1 });
  });

  it('notificationActionValue falls back to empty string', () => {
    expect(notificationActionValue('approve')).toBe('approve');
    expect(notificationActionValue(undefined)).toBe('');
  });

  it('stringReaderResult only keeps strings', () => {
    expect(stringReaderResult('data:image')).toBe('data:image');
    expect(stringReaderResult(null)).toBeNull();
    expect(stringReaderResult(new ArrayBuffer(8))).toBeNull();
  });

  it('applyStringPreview sets only string results', () => {
    const setPreview = vi.fn();
    applyStringPreview('data:image', setPreview);
    expect(setPreview).toHaveBeenCalledWith('data:image');
    setPreview.mockClear();
    applyStringPreview(null, setPreview);
    expect(setPreview).not.toHaveBeenCalled();
  });

  it('fileReaderEventResult reads target result when present', async () => {
    const { fileReaderEventResult } = await import('../payment-form-guards');
    const withTarget = {
      target: { result: 'data:image' },
    } as ProgressEvent<FileReader>;
    expect(fileReaderEventResult(withTarget)).toBe('data:image');
    expect(fileReaderEventResult({ target: null } as ProgressEvent<FileReader>)).toBeUndefined();
  });
});

describe('turnstile helpers', () => {
  it('maps known codes and falls back for unknown codes', () => {
    expect(turnstileErrorMessage('110100')).toContain('Invalid sitekey');
    expect(turnstileErrorMessage('999999')).toContain('999999');
  });

  it('wireExistingTurnstileScript attaches load and error listeners', () => {
    const script = document.createElement('script');
    const onLoad = vi.fn();
    const onError = vi.fn();
    wireExistingTurnstileScript(script, onLoad, onError);
    script.dispatchEvent(new Event('load'));
    script.dispatchEvent(new Event('error'));
    expect(onLoad).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('retryTurnstileWidget resets when possible', () => {
    const reset = vi.fn();
    const remove = vi.fn();
    const clearWidgetId = vi.fn();
    const scheduleRerender = vi.fn();
    retryTurnstileWidget({
      widgetId: 'w1',
      turnstile: { reset, remove } as unknown as Window['turnstile'],
      clearWidgetId,
      scheduleRerender,
    });
    expect(reset).toHaveBeenCalledWith('w1');
    expect(scheduleRerender).not.toHaveBeenCalled();
  });

  it('retryTurnstileWidget recovers when only reset fails', () => {
    const remove = vi.fn();
    const clearWidgetId = vi.fn();
    const scheduleRerender = vi.fn();
    retryTurnstileWidget({
      widgetId: 'w1',
      turnstile: {
        reset: () => {
          throw new Error('reset failed');
        },
        remove,
      } as unknown as Window['turnstile'],
      clearWidgetId,
      scheduleRerender,
    });
    expect(remove).toHaveBeenCalledWith('w1');
    expect(clearWidgetId).toHaveBeenCalledOnce();
    expect(scheduleRerender).toHaveBeenCalledOnce();
  });

  it('retryTurnstileWidget schedules rerender without widget', () => {
    const scheduleRerender = vi.fn();
    retryTurnstileWidget({
      widgetId: null,
      turnstile: undefined,
      clearWidgetId: vi.fn(),
      scheduleRerender,
    });
    expect(scheduleRerender).toHaveBeenCalledOnce();
  });
});
