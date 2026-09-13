import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { LedgerTokenProps } from '@/components/landing/ledger-hero';

/**
 * Three micro-scenes for the "How it works" panels — same ledger vernacular
 * as the hero composition (receipt rows, tabular figures, one green settle),
 * one line of caption each. Each plays once when scrolled into view, then
 * swaps to its static end state (see scene-statics.tsx): Remotion's Player
 * resets to frame 0 on end and seekTo-holds recurse, so the swap IS the hold.
 */

export type SceneTokenProps = LedgerTokenProps & {
  readonly receiptCount: string;
  readonly overdueWeeks: string;
  readonly balancesHeader: string;
  readonly afterSettlementHeader: string;
  readonly paidLine: string;
  readonly confirmedLabel: string;
};
export type SceneIndex = 1 | 2 | 3 | 5 | 6 | 7;

const FONT = "'Albert Sans', ui-sans-serif, system-ui, sans-serif";
const SCENE_DURATION_IN_FRAMES = 110;

function useSpringProgress(delay: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
}

function CountUp({
  target,
  delay,
  color,
  size,
}: {
  readonly target: number;
  readonly delay: number;
  readonly color: string;
  readonly size: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const value =
    target *
    interpolate(progress, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color, fontSize: size }}>
      ${value.toFixed(2)}
    </span>
  );
}

const ATTENDEES = ['Priya', 'Tom', 'Mei', 'Sam'] as const;

function ReceiptScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const header = spring({ frame, fps, config: { damping: 200 } });
  const totalStamp = spring({ frame: frame - 62, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: `1px solid ${tokens.border}`,
          paddingBottom: 8,
          opacity: header,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>
          Ramen Ya
          <span
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 400,
              color: tokens.muted,
              marginTop: 2,
            }}
          >
            Feb 24, 12:47 PM
          </span>
        </span>
        <span
          style={{
            fontSize: 15,
            color: tokens.muted,
            fontVariantNumeric: 'tabular-nums',
            opacity: interpolate(totalStamp, [0, 1], [0.4, 1]),
          }}
        >
          $56.00
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        {ATTENDEES.map((name, index) => {
          const progress = spring({ frame: frame - 16 + index * 9, fps, config: { damping: 200 } });
          const draw = interpolate(progress, [0, 1], [1, 0]);
          return (
            <li
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                opacity: progress,
              }}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke={tokens.success}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={draw}
                />
              </svg>
              <span style={{ fontSize: 15, color: tokens.text }}>{name}</span>
            </li>
          );
        })}
      </ul>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          opacity: totalStamp,
          transform: `scale(${interpolate(totalStamp, [0, 1], [1.12, 1])})`,
          transformOrigin: 'right bottom',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.text,
            background: 'transparent',
            border: `1.5px solid ${tokens.border}`,
            borderRadius: 6,
            padding: '3px 10px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {tokens.receiptCount}
        </span>
      </div>
    </AbsoluteFill>
  );
}

function BalancesScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          { rank: 1, name: 'Priya', amount: 42.0, size: 19 },
          { rank: 2, name: 'Tom', amount: 28.5, size: 16 },
          { rank: 3, name: 'Mei', amount: 19.25, size: 16 },
        ].map((debt) => (
          <BalanceRow key={debt.name} {...debt} tokens={tokens} />
        ))}
      </ul>
    </AbsoluteFill>
  );
}

function BalanceRow({
  rank,
  name,
  amount,
  size,
  tokens,
}: {
  readonly rank: number;
  readonly name: string;
  readonly amount: number;
  readonly size: number;
  readonly tokens: SceneTokenProps;
}) {
  const delay = 4 + (rank - 1) * 8;
  const progress = useSpringProgress(delay);
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '11px 0',
        borderBottom: `1px dashed ${tokens.border}`,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 12}px)`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
          #{rank}
        </span>
        <span style={{ fontWeight: 500, color: tokens.text, fontSize: size }}>{name}</span>
      </span>
      <CountUp
        target={amount}
        delay={delay + 8}
        color={tokens.danger}
        size={rank === 1 ? 20 : 16}
      />
    </li>
  );
}

function SettleScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = spring({ frame, fps, config: { damping: 200 } });
  const stamp = spring({ frame: frame - 52, fps, config: { damping: 200 } });
  const settledColor = tokens.success;

  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
        {tokens.afterSettlementHeader}
      </div>
      <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
        <li
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '11px 0',
            borderBottom: `1px dashed ${tokens.border}`,
            opacity: rows,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
              #1
            </span>
            <span
              style={{
                fontWeight: 500,
                fontSize: 17,
                color: stamp > 0.5 ? tokens.text : tokens.text,
              }}
            >
              Priya
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 20,
                color: interpolate(stamp, [0, 1], [0, 1]) > 0.5 ? settledColor : tokens.danger,
              }}
            >
              $42.00
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: settledColor,
                border: `1px solid ${settledColor}`,
                borderRadius: 999,
                padding: '2px 8px',
                opacity: stamp,
                transform: `scale(${interpolate(stamp, [0, 1], [1.25, 1])})`,
              }}
            >
              {tokens.settledLabel}
            </span>
          </span>
        </li>
        <li
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '11px 0',
            borderBottom: `1px dashed ${tokens.border}`,
            opacity: interpolate(
              spring({ frame: frame - 10, fps, config: { damping: 200 } }),
              [0, 1],
              [0, 1]
            ),
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
              #2
            </span>
            <span style={{ fontWeight: 500, fontSize: 15, color: tokens.text }}>Tom</span>
          </span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 16,
              color: tokens.danger,
            }}
          >
            $28.50
          </span>
        </li>
      </ul>
    </AbsoluteFill>
  );
}

function PaymentScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const row = spring({ frame, fps, config: { damping: 200 } });
  const press = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const confirmed = frame >= 58;

  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, opacity: row }}>
          <li
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 500, color: tokens.text }}>
              {tokens.paidLine}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: tokens.text,
              }}
            >
              $28.50
            </span>
          </li>
          <li
            style={{
              padding: '10px 0 14px',
              borderBottom: `1px dashed ${tokens.border}`,
            }}
          >
            {confirmed ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: tokens.success,
                  border: `1.5px solid ${tokens.success}`,
                  borderRadius: 999,
                  padding: '3px 12px',
                }}
              >
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tokens.success}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {tokens.confirmedLabel}
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: tokens.muted,
                  border: `1.5px solid ${tokens.border}`,
                  borderRadius: 999,
                  padding: '3px 12px',
                  transform: `scale(${interpolate(press, [0, 0.5, 1], [1, 0.94, 1])})`,
                }}
              >
                ✓
              </span>
            )}
          </li>
          <li
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0 0',
              opacity: confirmed ? 1 : 0.45,
            }}
          >
            <span style={{ fontSize: 15, color: tokens.text }}>Tom</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                fontSize: 15,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span
                style={{
                  color: tokens.muted,
                  textDecoration: confirmed ? 'line-through' : 'none',
                }}
              >
                $28.50
              </span>
              {confirmed ? (
                <span style={{ fontWeight: 600, color: tokens.success }}>$0.00</span>
              ) : null}
            </span>
          </li>
        </ul>
      </div>
    </AbsoluteFill>
  );
}

function RankedScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: tokens.muted, letterSpacing: '0.04em' }}>
        WHO OWES
      </div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        <RankedRow
          rank={1}
          name="Priya"
          amount="$42.00"
          tag={tokens.overdueWeeks}
          tokens={tokens}
          delay={10}
          big
          crown
        />
        <RankedRow rank={2} name="Tom" amount="$28.50" tokens={tokens} delay={18} big />
        <RankedRow rank={3} name="Mei" amount="$19.25" tokens={tokens} delay={26} big />
        <RankedRow rank={4} name="Sam" tokens={tokens} delay={34} big settled />
      </ul>
    </AbsoluteFill>
  );
}

function RankedRow({
  rank,
  name,
  amount,
  tag,
  tokens,
  delay,
  big,
  settled,
  crown,
}: {
  readonly rank: number;
  readonly name: string;
  readonly amount?: string;
  readonly tag?: string;
  readonly tokens: SceneTokenProps;
  readonly delay: number;
  readonly big?: boolean;
  readonly settled?: boolean;
  readonly crown?: boolean;
}) {
  const progress = useSpringProgress(delay);
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 0',
        borderBottom: `1px dashed ${tokens.border}`,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 12}px)`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
          #{rank}
        </span>
        <span
          style={{
            fontWeight: 500,
            color: settled ? tokens.muted : tokens.text,
            fontSize: big ? 17 : 15,
          }}
        >
          {name}
        </span>
        {crown ? (
          <svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.danger}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ alignSelf: 'center', flexShrink: 0 }}
          >
            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
            <path d="M5 21h14" />
          </svg>
        ) : null}
        {tag ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.danger,
              border: `1px solid ${tokens.danger}`,
              borderRadius: 999,
              padding: '1px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
          </span>
        ) : null}
      </span>
      {settled ? (
        <span style={{ fontSize: 13, fontWeight: 500, color: tokens.success }}>
          {tokens.settledLabel}
        </span>
      ) : (
        <span
          style={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: tokens.danger,
            fontSize: big ? 20 : 16,
          }}
        >
          {amount}
        </span>
      )}
    </li>
  );
}

const FAVORITES = [
  { name: 'Ramen Ya', width: '82%', visits: '12', favorite: true },
  { name: 'Pho Corner', width: '55%', visits: '7', favorite: false },
  { name: 'Café Luna', width: '34%', visits: '4', favorite: false },
] as const;

function FavoriteScene({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <AbsoluteFill style={{ background: tokens.surface, padding: '16px 20px', fontFamily: FONT }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {FAVORITES.map((spot, index) => (
          <FavoriteBar key={spot.name} {...spot} tokens={tokens} delay={8 + index * 12} />
        ))}
      </ul>
    </AbsoluteFill>
  );
}

function FavoriteBar({
  name,
  width,
  visits,
  favorite,
  tokens,
  delay,
}: {
  readonly name: string;
  readonly width: string;
  readonly visits: string;
  readonly favorite: boolean;
  readonly tokens: SceneTokenProps;
  readonly delay: number;
}) {
  const progress = useSpringProgress(delay);
  const grow = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <li style={{ padding: '9px 0', opacity: progress }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: favorite ? 600 : 500,
            color: favorite ? tokens.text : tokens.muted,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 13,
            color: favorite ? tokens.success : tokens.muted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {visits}
        </span>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: tokens.border }}>
        <div
          style={{
            width: `calc(${width} * ${grow})`,
            height: '100%',
            borderRadius: 999,
            background: favorite ? tokens.success : tokens.muted,
            opacity: favorite ? 1 : 0.55,
          }}
        />
      </div>
    </li>
  );
}

/** Player host per panel: plays once when scrolled into view, then swaps to
 * the static end state (supplied by the page — keeps remotion out of the
 * initial bundle). */
export default function StepSceneCard(props: {
  readonly index: SceneIndex;
  readonly tokens: SceneTokenProps;
  readonly staticFallback: React.ReactNode;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const [visible, setVisible] = useState(false);
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

  useEffect(() => {
    if (reducedMotion || settled) return;
    const target = wrapRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [reducedMotion, settled]);

  useEffect(() => {
    if (reducedMotion || settled || !visible) return;
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
      const startPlayback = (attempt: number): void => {
        if (disposed || attempt >= 8) return;
        void Promise.resolve(player.play()).catch(() => {
          window.setTimeout(() => startPlayback(attempt + 1), 250);
        });
      };
      const startTimeout = window.setTimeout(() => startPlayback(0), 120);
      const onPause = (): void => {
        if (player.getCurrentFrame() < SCENE_DURATION_IN_FRAMES - 2 && playAttempts < 3) {
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
  }, [reducedMotion, settled, visible]);

  // Before the panel is scrolled into view, while it plays, and after it
  // ends: the static end state. Early return sits after every hook.
  if (reducedMotion || settled || !visible) {
    return <>{props.staticFallback}</>;
  }

  const scenes = {
    1: ReceiptScene,
    2: BalancesScene,
    3: SettleScene,
    5: PaymentScene,
    6: RankedScene,
    7: FavoriteScene,
  } as const;
  const Scene = scenes[props.index];

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Player
        component={Scene}
        durationInFrames={SCENE_DURATION_IN_FRAMES}
        fps={30}
        compositionWidth={360}
        compositionHeight={240}
        inputProps={{ tokens: props.tokens }}
        loop={false}
        controls={false}
        clickToPlay={false}
        spaceKeyToPlayOrPause={false}
        acknowledgeRemotionLicense
        ref={playerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
