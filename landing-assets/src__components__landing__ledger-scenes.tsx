import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import type { LedgerTokenProps } from '@/components/landing/ledger-hero';

/**
 * Host for the how-it-works replica scenes (see app-ui). Plays the given
 * scene once when scrolled into view, then swaps to the static end state:
 * Remotion's Player resets to frame 0 on end and seekTo-holds recurse, so
 * the swap IS the hold.
 */

export type SceneTokenProps = LedgerTokenProps & {
  readonly receiptCount: string;
  readonly overdueWeeks: string;
  readonly balancesHeader: string;
  readonly afterSettlementHeader: string;
  readonly paidLine: string;
  readonly confirmedLabel: string;
};

const SCENE_DURATION_IN_FRAMES = 110;

export default function StepSceneCard(props: {
  readonly tokens: SceneTokenProps;
  readonly scene: React.ComponentType<{ readonly tokens: SceneTokenProps }>;
  readonly durationInFrames?: number;
  readonly compositionHeight?: number;
  readonly staticFallback: React.ReactNode;
}) {
  const duration = props.durationInFrames ?? SCENE_DURATION_IN_FRAMES;
  const compositionHeight = props.compositionHeight ?? 240;
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
        if (player.getCurrentFrame() < duration - 2 && playAttempts < 3) {
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
  }, [reducedMotion, settled, visible, duration]);

  // Before the panel is scrolled into view, while it plays, and after it
  // ends: the static end state. Early return sits after every hook.
  if (reducedMotion || settled || !visible) {
    return <>{props.staticFallback}</>;
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Player
        component={props.scene}
        durationInFrames={duration}
        fps={30}
        compositionWidth={360}
        compositionHeight={compositionHeight}
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
