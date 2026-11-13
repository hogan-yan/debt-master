import type { SceneTokenProps } from '@/components/landing/ledger-scenes';

/**
 * Real-app replica kit for the landing scenes. Every piece mirrors the app's
 * Card/row/badge anatomy with the same tokens the landing already feeds its
 * scenes (SCENE_TOKENS mirrors app.css). The optional extras let a bare
 * SceneTokenProps render correctly while the page feeds the full set.
 */

export type AppUiTokens = SceneTokenProps & {
  // app.css --card: white in light, 0 0% 12% in dark (one step above canvas).
  readonly cardSurface?: string;
  // Boot gates / handshake labels for the replica flows (page supplies from
  // paraglide keys).
  readonly waitingLabel?: string;
  readonly confirmAction?: string;
  readonly whoNeedsToPay?: string;
};

export const FONT_UI = "'Albert Sans', ui-sans-serif, system-ui, sans-serif";

const CARD_SHADOW = '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)';

export function UiCard(props: {
  readonly tokens: AppUiTokens;
  readonly children: React.ReactNode;
  readonly opacity?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: props.tokens.cardSurface ?? props.tokens.surface,
        border: `1px solid ${props.tokens.border}`,
        borderRadius: 10,
        boxShadow: CARD_SHADOW,
        padding: '10px 12px',
        fontFamily: FONT_UI,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        opacity: props.opacity ?? 1,
      }}
    >
      {props.children}
    </div>
  );
}

// lucide "crown" — the icon the dashboard's debtor card header uses.
export function CrownIcon(props: { readonly size: number; readonly color: string }) {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function UiCardHeader(props: {
  readonly tokens: AppUiTokens;
  readonly title: string;
  readonly crown?: boolean;
  readonly right?: string;
  readonly opacity?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        paddingBottom: 6,
        borderBottom: `1px solid ${props.tokens.border}`,
        opacity: props.opacity ?? 1,
      }}
    >
      {props.crown ? <CrownIcon size={15} color={props.tokens.text} /> : null}
      <span style={{ fontSize: 13, fontWeight: 600, color: props.tokens.text, flex: 1 }}>
        {props.title}
      </span>
      {props.right ? (
        <span
          style={{
            fontSize: 12,
            color: props.tokens.muted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {props.right}
        </span>
      ) : null}
    </div>
  );
}

export function UiBadge(props: {
  readonly tokens: AppUiTokens;
  readonly label: string;
  readonly tone: 'muted' | 'success';
  readonly opacity?: number;
}): React.JSX.Element {
  const success = props.tone === 'success';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        color: success ? props.tokens.success : props.tokens.muted,
        border: success ? `1px solid ${props.tokens.success}` : `1px solid ${props.tokens.border}`,
        opacity: props.opacity ?? 1,
      }}
    >
      {props.label}
    </span>
  );
}

export function UiAvatarRow(props: {
  readonly tokens: AppUiTokens;
  readonly initials: string;
  readonly name: string;
  readonly nameColor?: string;
  readonly right: React.ReactNode;
  readonly badge?: React.ReactNode;
  readonly rank?: string;
  readonly grow?: boolean;
  readonly dim?: boolean;
  readonly opacity?: number;
  readonly translateY?: number | string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flex: props.grow ? 1 : undefined,
        gap: 8,
        padding: '6px 0',
        borderBottom: `1px dashed ${props.tokens.border}`,
        opacity: props.opacity ?? 1,
        transform: props.translateY ? `translateY(${props.translateY}px)` : undefined,
      }}
    >
      {props.rank !== undefined ? (
        <span
          style={{
            fontSize: 11,
            color: props.tokens.muted,
            fontVariantNumeric: 'tabular-nums',
            width: 14,
          }}
        >
          {props.rank}
        </span>
      ) : null}
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
        {props.initials}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: props.nameColor ?? (props.dim ? props.tokens.muted : props.tokens.text),
          flex: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {props.name}
      </span>
      {props.badge}
      {props.right}
    </div>
  );
}

export function UiAmount(props: {
  readonly tokens: AppUiTokens;
  readonly value: string;
  readonly tone?: 'debt' | 'success' | 'ink';
  readonly size?: number;
}): React.JSX.Element {
  const color =
    props.tone === 'success'
      ? props.tokens.success
      : props.tone === 'ink'
        ? props.tokens.text
        : props.tokens.danger;
  return (
    <span
      style={{
        fontSize: props.size ?? 13,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {props.value}
    </span>
  );
}
