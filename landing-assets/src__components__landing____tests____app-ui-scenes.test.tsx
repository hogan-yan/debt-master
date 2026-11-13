import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { APP_UI_SCENES } from '../app-ui';

const TOKENS = {
  surface: '#ffffff',
  text: '#0a0a14',
  muted: '#5b6472',
  border: '#e3e7ee',
  danger: '#d91317',
  success: '#1a7a52',
  caption: "This week's tab",
  outstandingLabel: 'Outstanding',
  settledLabel: 'Settled up',
  receiptCount: '4 people',
  overdueWeeks: '3 weeks overdue',
  balancesHeader: 'Current balances',
  afterSettlementHeader: 'After settlement',
  paidLine: 'Tom paid Mei',
  confirmedLabel: 'Confirmed',
  cardSurface: '#ffffff',
  waitingLabel: 'Waiting',
  confirmAction: 'Confirm',
  whoNeedsToPay: 'Who Needs to Pay for Lunch?',
};

// The statics are the SSR / reduced-motion / post-play surface — they must
// render WITHOUT a Remotion context (pure layout fns at final progress) and
// carry each scene's end-state story.
describe('app-ui static end states', () => {
  it.each([1, 2, 3] as const)('scene %i renders its static end state', (index) => {
    const Static = APP_UI_SCENES[index].Static;
    const html = renderToString(<Static tokens={TOKENS} />);
    expect(html).toContain('Albert Sans');
  });

  it('step 1 shows the logged Ramen Ya expense', () => {
    const Static = APP_UI_SCENES[1].Static;
    const html = renderToString(<Static tokens={TOKENS} />);
    expect(html).toContain('Ramen Ya');
    expect(html).toContain('$56.00');
  });

  it('step 2 shows the settled rank order after the swap', () => {
    const Static = APP_UI_SCENES[2].Static;
    const html = renderToString(<Static tokens={TOKENS} />);
    // Tom paid $20: 28.50 → 8.50, dropping below Mei's 19.25.
    expect(html).toContain('$8.50');
    expect(html).toContain('$19.25');
  });

  it('step 3 shows the flipped confirmed state', () => {
    const Static = APP_UI_SCENES[3].Static;
    const html = renderToString(<Static tokens={TOKENS} />);
    expect(html).toContain('Confirmed');
  });
});
