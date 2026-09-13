import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * "The tab balances" — the ledger panel writes itself in reading order:
 * caption, then ranks #1–#3 cascade, the total counts up and lands as THE
 * number, and the settled row closes in success green. One orchestrated
 * moment (DEBTM-200: one motion concept per surface), damping 200 — the
 * steady hand of a ledger being written, not a toy.
 *
 * Composition for @remotion/player. All animation from useCurrentFrame +
 * spring/interpolate, both clamped. Text is real DOM (crawlable, i18n'd,
 * theme-reactive via inputProps tokens) — never gated: the page headline
 * and CTA live outside this canvas.
 */

export type LedgerTokenProps = {
  surface: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  success: string;
  caption: string;
  outstandingLabel: string;
  settledLabel: string;
};

const DEFAULT_TOKENS: LedgerTokenProps = {
  surface: '#ffffff',
  text: '#0a0a14',
  muted: '#5b6472',
  border: '#e3e7ee',
  danger: '#d91317',
  success: '#1a7a52',
  caption: "This week's tab",
  outstandingLabel: 'Outstanding',
  settledLabel: 'Settled up',
} satisfies LedgerTokenProps;

const SAMPLE_DEBTS = [
  { rank: 1, name: 'Priya', amount: '42.00' },
  { rank: 2, name: 'Tom', amount: '28.50' },
  { rank: 3, name: 'Mei', amount: '19.25' },
] as const;

const TOTAL_OUTSTANDING = '89.75';
const DURATION_IN_FRAMES = 120;
const FONT = "'Albert Sans', ui-sans-serif, system-ui, sans-serif";

const rowSpring = (frame: number, fps: number, delay: number): number =>
  spring({ frame: frame - delay, fps, config: { damping: 200 } });

const Row: React.FC<{
  readonly rank: number;
  readonly name: string;
  readonly amount: string;
  readonly danger: string;
  readonly border: string;
  readonly text: string;
  readonly muted: string;
  readonly delay: number;
}> = ({ rank, name, amount, danger, border, text, muted, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = rowSpring(frame, fps, delay);

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: `1px dashed ${border}`,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 14}px)`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: muted, fontVariantNumeric: 'tabular-nums' }}>
          #{rank}
        </span>
        <span
          style={{
            fontWeight: 500,
            color: text,
            fontSize: rank === 1 ? 17 : 16,
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
      </span>
      <span
        style={{
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: danger,
          fontSize: rank === 1 ? 20 : 16,
        }}
      >
        ${amount}
      </span>
    </li>
  );
};

export const LedgerHero: React.FC<Partial<LedgerTokenProps>> = (props) => {
  const tokens = { ...DEFAULT_TOKENS, ...props };
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // prefers-reduced-motion is handled by the host (LedgerHeroCard): it swaps
  // in the static end-state instead of mounting the Player at all.
  const captionProgress = rowSpring(frame, fps, 0);
  const settledProgress = rowSpring(frame, fps, 96);
  const totalProgress = interpolate(
    spring({ frame: frame - 36, fps, config: { damping: 200 } }),
    [0, 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const total = (Number.parseFloat(TOTAL_OUTSTANDING) * totalProgress).toFixed(2);

  return (
    <AbsoluteFill
      style={{
        background: tokens.surface,
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: tokens.muted,
          opacity: captionProgress,
        }}
      >
        {tokens.caption}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 42,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: tokens.danger,
          letterSpacing: '-0.01em',
        }}
      >
        ${total}
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
        >
          {tokens.outstandingLabel}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
        {SAMPLE_DEBTS.map((debt, index) => (
          <Row
            key={debt.name}
            rank={debt.rank}
            name={debt.name}
            amount={debt.amount}
            danger={tokens.danger}
            border={tokens.border}
            text={tokens.text}
            muted={tokens.muted}
            delay={6 + index * 5}
          />
        ))}
        <li
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 0 0',
            opacity: settledProgress,
            transform: `translateY(${(1 - settledProgress) * 14}px)`,
          }}
        >
          <span style={{ fontWeight: 500, color: tokens.muted, fontSize: 16 }}>Sam</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: tokens.success }}>
            {tokens.settledLabel}
          </span>
        </li>
      </ul>
    </AbsoluteFill>
  );
};

export { DURATION_IN_FRAMES as LEDGER_HERO_DURATION_IN_FRAMES };

/**
 * Player host — lazy-loaded as one chunk with the composition above so the
 * landing's initial bundle stays clean; the page SSRs the static ledger and
 * this upgrades it in place after hydration.
 */
export default function LedgerHeroCard(props: {
  readonly tokens: Partial<LedgerTokenProps>;
  readonly staticFallback: React.ReactNode;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const [settled, setSettled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setReducedMotion(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Play once, then swap to the static ledger on 'ended': the Player resets
  // to frame 0 when playback ends (seekTo()-based holds recurse inside
  // Remotion's isPlaying/seekTo and take the page down), and the static
  // markup is pixel-identical to the composition's final frame. The Player
  // sets its ref asynchronously (it suspends internally on the first mount),
  // so poll for the ref, and a bounded replay covers the rare pause race
  // right after hydration.
  useEffect(() => {
    if (reducedMotion || settled) return;
    let disposed = false;
    let unbind: () => void = () => {};
    const attach = (attempts: number): void => {
      if (disposed) return;
      const player = playerRef.current;
      if (!player) {
        if (attempts < 40) window.setTimeout(() => attach(attempts + 1), 100);
        return;
      }
      let playAttempts = 0;
      // play() can reject while the Player is still initializing — retry with
      // backoff until the timeline actually advances.
      const startPlayback = (attempt: number): void => {
        if (disposed || attempt >= 8) return;
        void Promise.resolve(player.play()).catch(() => {
          window.setTimeout(() => startPlayback(attempt + 1), 250);
        });
      };
      const startTimeout = window.setTimeout(() => startPlayback(0), 150);
      const onPause = (): void => {
        if (player.getCurrentFrame() < DURATION_IN_FRAMES - 2 && playAttempts < 3) {
          playAttempts += 1;
          window.setTimeout(() => player.play(), 120 * playAttempts);
        }
      };
      const onEnded = (): void => {
        setSettled(true);
      };
      player.addEventListener('pause', onPause);
      player.addEventListener('ended', onEnded);
      unbind = () => {
        window.clearTimeout(startTimeout);
        player.removeEventListener('pause', onPause);
        player.removeEventListener('ended', onEnded);
      };
    };
    attach(0);
    return () => {
      disposed = true;
      unbind();
    };
  }, [reducedMotion, settled]);

  // After the animation (or with reduced motion): same ledger, zero
  // choreography (DEBTM-200 §5) — the page's static fallback is
  // pixel-identical to the composition's final frame. Early return is safe:
  // it sits after every hook.
  if (reducedMotion || settled) {
    return <>{props.staticFallback}</>;
  }

  return (
    <Player
      component={LedgerHero}
      durationInFrames={DURATION_IN_FRAMES}
      fps={30}
      compositionWidth={448}
      compositionHeight={340}
      inputProps={props.tokens}
      autoPlay
      loop={false}
      controls={false}
      clickToPlay={false}
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
      ref={playerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
