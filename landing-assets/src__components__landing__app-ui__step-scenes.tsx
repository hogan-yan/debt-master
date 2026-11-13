import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  type AppUiTokens,
  CrownIcon,
  UiAmount,
  UiAvatarRow,
  UiBadge,
  UiCard,
  UiCardHeader,
} from '@/components/landing/app-ui/pieces';
import type { SceneTokenProps } from '@/components/landing/ledger-scenes';

/**
 * The "How it works" step scenes as real-app replicas: one continuous story
 * (log the lunch → balances update → settle confirms) over the hero's own
 * data. Each scene is hooks + progress over a shared layout fn; the Static
 * twin renders the same layout with every progress at 1, so the end state
 * the player swaps to is pixel-identical to the SSR/reduced-motion surface.
 * Scene roots are AbsoluteFill (positioned by the Player container); Static
 * roots are plain full-size divs — they render bare inside the page, where
 * an AbsoluteFill would escape its figure and paint over the document.
 * Row lists use grow rows so the list fills the card at any canvas size,
 * and every row keeps the same rank/avatar/name/amount column grid.
 */

const PROGRESS_FINAL = 1;
const settle = (frame: number, fps: number, delay: number): number =>
  spring({ frame: frame - delay, fps, config: { damping: 200 } });
const clamp01 = (v: number): number =>
  interpolate(v, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
// Button-press dip: eases in and back out across the press window.
const pressScale = (p: number): number => 1 - (p > 0 && p < 1 ? 0.04 * Math.sin(p * Math.PI) : 0);

function StaticRoot(props: {
  readonly tokens: SceneTokenProps;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: props.tokens.surface,
        padding: '8px 10px',
        width: '100%',
        height: '100%',
      }}
    >
      {props.children}
    </div>
  );
}

// ── Step 1 · Log the lunch ──────────────────────────────────────────────
// Expense card + inline add form; typing → press → the new expense row
// slides into the list, exactly like the app's expense screen.

type LogProgress = {
  readonly header: number;
  readonly rows: readonly [number, number];
  readonly form: number;
  readonly press: number;
  readonly newRow: number;
};

const LOG_FINAL: LogProgress = {
  header: PROGRESS_FINAL,
  rows: [PROGRESS_FINAL, PROGRESS_FINAL],
  form: PROGRESS_FINAL,
  press: PROGRESS_FINAL,
  newRow: PROGRESS_FINAL,
};

function LogLayout(props: { readonly tokens: AppUiTokens; readonly p: LogProgress }) {
  const venue = 'Ramen Ya';
  const typed = clamp01((props.p.form - 0.55) / 0.45);
  const visibleVenue = venue.slice(0, Math.max(0, Math.round(typed * venue.length)));
  const highlight = 1 - props.p.newRow * 0.85;
  const fieldStyle: React.CSSProperties = {
    fontSize: 12,
    color: props.p.form > 0.6 ? props.tokens.text : props.tokens.muted,
    border: `1px solid ${props.tokens.border}`,
    borderRadius: 8,
    padding: '5px 8px',
    minHeight: 26,
    boxSizing: 'border-box',
  };
  return (
    <UiCard tokens={props.tokens}>
      <UiCardHeader
        tokens={props.tokens}
        title="Lunch tab"
        right="Feb 24"
        opacity={props.p.header}
      />
      <div
        style={{
          marginTop: 4,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <UiAvatarRow
          tokens={props.tokens}
          initials="P"
          name="Grocery run"
          dim
          grow
          opacity={props.p.rows[0]}
          right={<UiAmount tokens={props.tokens} value="$14.20" tone="ink" />}
        />
        <UiAvatarRow
          tokens={props.tokens}
          initials="T"
          name="Train tickets"
          dim
          grow
          opacity={props.p.rows[1]}
          right={<UiAmount tokens={props.tokens} value="$9.80" tone="ink" />}
        />
        <UiAvatarRow
          tokens={props.tokens}
          initials="P"
          name={venue}
          grow
          opacity={props.p.newRow}
          translateY={(1 - props.p.newRow) * 8}
          badge={
            <span
              style={{
                fontSize: 10,
                color: props.tokens.muted,
                background: props.tokens.border,
                borderRadius: 999,
                padding: '1px 7px',
                opacity: highlight,
              }}
            >
              4 people
            </span>
          }
          right={<UiAmount tokens={props.tokens} value="$56.00" tone="debt" />}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginTop: 'auto',
          paddingTop: 8,
          opacity: props.p.form * (props.p.press > 0.9 ? 0.45 : 1),
        }}
      >
        <span style={{ ...fieldStyle, flex: 1 }}>{visibleVenue}</span>
        <span
          style={{
            ...fieldStyle,
            fontVariantNumeric: 'tabular-nums',
            width: 52,
            textAlign: 'right',
          }}
        >
          $56.00
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: props.tokens.surface,
            background: props.tokens.text,
            borderRadius: 8,
            padding: '5px 12px',
            transform: `scale(${pressScale(props.p.press)})`,
          }}
        >
          Add
        </span>
      </div>
    </UiCard>
  );
}

export function LogExpenseScene(props: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p: LogProgress = {
    header: settle(frame, fps, 0),
    rows: [settle(frame, fps, 10), settle(frame, fps, 18)],
    form: settle(frame, fps, 38),
    press: clamp01((frame - 78) / 10),
    newRow: settle(frame, fps, 96),
  };
  return (
    <AbsoluteFill style={{ background: props.tokens.surface, padding: '8px 10px' }}>
      <LogLayout tokens={props.tokens} p={p} />
    </AbsoluteFill>
  );
}

export function LogExpenseStatic(props: { readonly tokens: AppUiTokens }) {
  return (
    <StaticRoot tokens={props.tokens}>
      <LogLayout tokens={props.tokens} p={LOG_FINAL} />
    </StaticRoot>
  );
}

// ── Step 2 · Balances update instantly ─────────────────────────────────
// Tom's $20 payment lands: his number ticks down and the list re-orders —
// Tom's $8.50 now ranks below Mei's $19.25. The re-order is rendered as a
// true order change; the two movers spring into their new slots from ±30px
// and decay to zero, so the settled list is always perfectly aligned.

type BalancesProgress = {
  readonly header: number;
  readonly rows: readonly [number, number, number, number];
  readonly count: number;
  readonly swap: number;
};

const BALANCES_FINAL: BalancesProgress = {
  header: PROGRESS_FINAL,
  rows: [PROGRESS_FINAL, PROGRESS_FINAL, PROGRESS_FINAL, PROGRESS_FINAL],
  count: PROGRESS_FINAL,
  swap: PROGRESS_FINAL,
};

function BalancesLayout(props: { readonly tokens: AppUiTokens; readonly p: BalancesProgress }) {
  const tomAmount = 28.5 + (8.5 - 28.5) * clamp01(props.p.count);
  const swapped = props.p.swap > 0.5;
  // 1 → 0 across the swap beat: the movers start ±30px off their new slots
  // and settle onto the shared column grid.
  const slide = 1 - clamp01(props.p.swap);
  return (
    <UiCard tokens={props.tokens}>
      <UiCardHeader
        tokens={props.tokens}
        title={props.tokens.balancesHeader}
        opacity={props.p.header}
      />
      <div
        style={{
          marginTop: 4,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <UiAvatarRow
          tokens={props.tokens}
          rank="1"
          initials="P"
          name="Priya"
          grow
          opacity={props.p.rows[0]}
          badge={
            props.p.rows[0] > 0.9 ? <CrownIcon size={13} color={props.tokens.text} /> : undefined
          }
          right={<UiAmount tokens={props.tokens} value="$42.00" tone="debt" size={14} />}
        />
        {swapped ? (
          <UiAvatarRow
            tokens={props.tokens}
            rank="2"
            initials="M"
            name="Mei"
            grow
            translateY={-30 * slide}
            right={<UiAmount tokens={props.tokens} value="$19.25" tone="debt" />}
          />
        ) : (
          <UiAvatarRow
            tokens={props.tokens}
            rank="2"
            initials="T"
            name="Tom"
            grow
            opacity={props.p.rows[1]}
            right={
              <UiAmount tokens={props.tokens} value={`$${tomAmount.toFixed(2)}`} tone="debt" />
            }
          />
        )}
        {swapped ? (
          <UiAvatarRow
            tokens={props.tokens}
            rank="3"
            initials="T"
            name="Tom"
            grow
            translateY={30 * slide}
            right={<UiAmount tokens={props.tokens} value="$8.50" tone="debt" />}
          />
        ) : (
          <UiAvatarRow
            tokens={props.tokens}
            rank="3"
            initials="M"
            name="Mei"
            grow
            opacity={props.p.rows[2]}
            right={<UiAmount tokens={props.tokens} value="$19.25" tone="debt" />}
          />
        )}
        <UiAvatarRow
          tokens={props.tokens}
          initials="S"
          name="Sam"
          rank=""
          dim
          grow
          opacity={props.p.rows[3]}
          right={<UiBadge tokens={props.tokens} label={props.tokens.settledLabel} tone="success" />}
        />
      </div>
    </UiCard>
  );
}

export function BalancesScene(props: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p: BalancesProgress = {
    header: settle(frame, fps, 0),
    rows: [
      settle(frame, fps, 8),
      settle(frame, fps, 16),
      settle(frame, fps, 24),
      settle(frame, fps, 32),
    ],
    count: settle(frame, fps, 35),
    swap: settle(frame, fps, 62),
  };
  return (
    <AbsoluteFill style={{ background: props.tokens.surface, padding: '8px 10px' }}>
      <BalancesLayout tokens={props.tokens} p={p} />
    </AbsoluteFill>
  );
}

export function BalancesStatic(props: { readonly tokens: AppUiTokens }) {
  return (
    <StaticRoot tokens={props.tokens}>
      <BalancesLayout tokens={props.tokens} p={BALANCES_FINAL} />
    </StaticRoot>
  );
}

// ── Step 3 · Settle and confirm ────────────────────────────────────────
// Payment row lands waiting, confirm presses, the badge flips green —
// the app's settlement handshake, one beat per state.

type ConfirmProgress = {
  readonly header: number;
  readonly row: number;
  readonly btn: number;
  readonly press: number;
  readonly flip: number;
};

const CONFIRM_FINAL: ConfirmProgress = {
  header: PROGRESS_FINAL,
  row: PROGRESS_FINAL,
  btn: PROGRESS_FINAL,
  press: PROGRESS_FINAL,
  flip: PROGRESS_FINAL,
};

function ConfirmLayout(props: { readonly tokens: AppUiTokens; readonly p: ConfirmProgress }) {
  const done = props.p.flip;
  const flipped = done > 0.5;
  return (
    <UiCard tokens={props.tokens}>
      <UiCardHeader
        tokens={props.tokens}
        title={props.tokens.afterSettlementHeader}
        opacity={props.p.header}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 10px',
            borderRadius: 8,
            border: `1px solid ${flipped ? props.tokens.success : props.tokens.border}`,
            background: `color-mix(in oklab, ${props.tokens.success} ${Math.round(done * 8)}%, transparent)`,
            opacity: props.p.row,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: props.tokens.muted,
              color: props.tokens.surface,
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            T
          </span>
          <span style={{ fontSize: 12.5, color: props.tokens.text, flex: 1, whiteSpace: 'nowrap' }}>
            {props.tokens.paidLine}
          </span>
          <UiAmount tokens={props.tokens} value="$20.00" tone={flipped ? 'success' : 'debt'} />
          <UiBadge
            tokens={props.tokens}
            label={flipped ? props.tokens.confirmedLabel : (props.tokens.waitingLabel ?? '')}
            tone={flipped ? 'success' : 'muted'}
            opacity={flipped ? clamp01((done - 0.5) / 0.5) : 1}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 10,
            opacity: props.p.btn * (1 - done),
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: props.tokens.surface,
              background: props.tokens.text,
              borderRadius: 8,
              padding: '6px 14px',
              transform: `scale(${pressScale(props.p.press)})`,
            }}
          >
            {props.tokens.confirmAction ?? ''}
          </span>
        </div>
      </div>
    </UiCard>
  );
}

export function ConfirmScene(props: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p: ConfirmProgress = {
    header: settle(frame, fps, 0),
    row: settle(frame, fps, 12),
    btn: settle(frame, fps, 40),
    press: clamp01((frame - 58) / 10),
    flip: settle(frame, fps, 66),
  };
  return (
    <AbsoluteFill style={{ background: props.tokens.surface, padding: '8px 10px' }}>
      <ConfirmLayout tokens={props.tokens} p={p} />
    </AbsoluteFill>
  );
}

export function ConfirmStatic(props: { readonly tokens: AppUiTokens }) {
  return (
    <StaticRoot tokens={props.tokens}>
      <ConfirmLayout tokens={props.tokens} p={CONFIRM_FINAL} />
    </StaticRoot>
  );
}
