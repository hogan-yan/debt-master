import { vi } from 'vitest';

export let storageState: Record<string, string> = {};

const ls = window.localStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

ls.getItem.mockImplementation((key: string) => storageState[key] ?? null);
ls.setItem.mockImplementation((key: string, value: string) => {
  storageState[key] = value;
});
ls.removeItem.mockImplementation((key: string) => {
  delete storageState[key];
});
ls.clear.mockImplementation(() => {
  storageState = {};
});

export function resetStorageState(): void {
  storageState = {};
  Object.defineProperty(document, 'cookie', { writable: true, value: '' });
}
