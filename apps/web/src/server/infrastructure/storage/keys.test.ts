import { describe, expect, it } from 'vitest';
import { generateObjectKey, sanitizeForHeader, sanitizeForStorage } from './keys';

describe('sanitizeForStorage', () => {
  it('keeps alphanumerics, dots, and dashes', () => {
    expect(sanitizeForStorage('receipt.2024-final.pdf')).toBe('receipt.2024-final.pdf');
  });

  it('replaces spaces and special characters with underscores', () => {
    expect(sanitizeForStorage('my receipt (1).pdf')).toBe('my_receipt__1_.pdf');
  });

  it('replaces non-ASCII characters with underscores', () => {
    expect(sanitizeForStorage('領収書.pdf')).toBe('___.pdf');
  });
});

describe('sanitizeForHeader', () => {
  it('removes non-ASCII characters', () => {
    expect(sanitizeForHeader('café.png')).toBe('caf_.png');
  });

  it('replaces quotes, backslashes, CR, LF, tabs', () => {
    expect(sanitizeForHeader('a"b\\c\rd\ne\tf')).toBe('a_b_c_d_e_f');
  });

  it('trims whitespace', () => {
    expect(sanitizeForHeader('  name.png  ')).toBe('name.png');
  });

  it('truncates to 200 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeForHeader(long)).toHaveLength(200);
  });
});

describe('generateObjectKey', () => {
  it('prefixes with receipts/ and the timestamp', () => {
    expect(generateObjectKey('file.png', 1_700_000_000_000)).toBe(
      'receipts/1700000000000-file.png'
    );
  });

  it('sanitizes the filename into the key', () => {
    expect(generateObjectKey('my file!.png', 100)).toBe('receipts/100-my_file_.png');
  });
});
