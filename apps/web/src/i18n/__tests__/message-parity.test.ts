import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ja from '../../../messages/ja.json';
import zhTw from '../../../messages/zh-tw.json';

function getMessageKeys(messages: Record<string, string>): string[] {
  return Object.keys(messages)
    .filter((k) => k !== '$schema')
    .sort();
}

describe('i18n message file parity', () => {
  const enKeys = getMessageKeys(en);
  const zhTwKeys = getMessageKeys(zhTw);
  const jaKeys = getMessageKeys(ja);

  it('zh-tw has all keys from en', () => {
    const missing = enKeys.filter((k) => !zhTwKeys.includes(k));
    expect(missing, `zh-tw missing keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('ja has all keys from en', () => {
    const missing = enKeys.filter((k) => !jaKeys.includes(k));
    expect(missing, `ja missing keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('en has no extra keys absent from zh-tw', () => {
    const extra = zhTwKeys.filter((k) => !enKeys.includes(k));
    expect(extra, `zh-tw has unknown keys: ${extra.join(', ')}`).toEqual([]);
  });

  it('en has no extra keys absent from ja', () => {
    const extra = jaKeys.filter((k) => !enKeys.includes(k));
    expect(extra, `ja has unknown keys: ${extra.join(', ')}`).toEqual([]);
  });
});
