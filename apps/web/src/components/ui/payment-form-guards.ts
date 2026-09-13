/**
 * Shared guards for payment proof / unified payment modal file handling.
 */

export function firstSelectedFile(files: FileList | null | undefined): File | undefined {
  return files?.[0];
}

export function resetFileInputValue(elementId: string): void {
  const fileInput = document.getElementById(elementId);
  if (fileInput instanceof HTMLInputElement) {
    fileInput.value = '';
  }
}

export function shouldBlockPaymentSubmit(isProcessing: boolean): boolean {
  return isProcessing;
}

export function captureFocusElement(active: Element | null): HTMLElement | null {
  return active instanceof HTMLElement ? active : null;
}

export function registerFormDebug(
  formEl: HTMLFormElement | null,
  form: unknown,
  map: WeakMap<HTMLFormElement, unknown>
): void {
  if (formEl) {
    map.set(formEl, form);
  }
}

export function notificationActionValue(action: string | undefined): string {
  return action ?? '';
}

export function stringReaderResult(result: string | ArrayBuffer | null | undefined): string | null {
  return typeof result === 'string' ? result : null;
}

export function applyStringPreview(
  result: string | ArrayBuffer | null | undefined,
  setPreview: (value: string) => void
): void {
  const preview = stringReaderResult(result);
  if (preview) {
    setPreview(preview);
  }
}

export function fileReaderEventResult(
  event: ProgressEvent<FileReader>
): string | ArrayBuffer | null | undefined {
  return event.target?.result;
}

export function withSelectedFile(
  files: FileList | null | undefined,
  onFile: (file: File) => void
): void {
  const file = firstSelectedFile(files);
  if (file) {
    onFile(file);
  }
}

export async function runUnlessProcessing(
  isProcessing: boolean,
  run: () => Promise<void>
): Promise<void> {
  if (shouldBlockPaymentSubmit(isProcessing)) {
    return;
  }
  await run();
}
