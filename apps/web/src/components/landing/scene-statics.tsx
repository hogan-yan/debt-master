import type { SceneIndex, SceneTokenProps } from '@/components/landing/ledger-scenes';

/**
 * Static end-state mirrors of the three step scenes (ledger-scenes.tsx).
 * Remotion-free so the page can render them eagerly as SSR/Suspense/
 * reduced-motion surfaces. Keep visually in sync with the compositions.
 */
export function StepStatic({
  index,
  tokens,
}: {
  readonly index: SceneIndex;
  readonly tokens: SceneTokenProps;
}) {
  return (
    <div
      style={{
        background: tokens.surface,
        padding: '18px 20px',
        fontFamily: "'Albert Sans', ui-sans-serif, system-ui, sans-serif",
        width: '100%',
        height: '100%',
      }}
    >
      {index === 1 ? <ReceiptStatic tokens={tokens} /> : null}
      {index === 2 ? <BalancesStatic tokens={tokens} /> : null}
      {index === 3 ? <SettleStatic tokens={tokens} /> : null}
      {index === 5 ? <PaymentStatic tokens={tokens} /> : null}
      {index === 6 ? <RankedStatic tokens={tokens} /> : null}
      {index === 7 ? <FavoriteStatic tokens={tokens} /> : null}
    </div>
  );
}

function ReceiptStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: `1px solid ${tokens.border}`,
          paddingBottom: 8,
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
        <span style={{ fontSize: 15, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
          $56.00
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        {['Priya', 'Tom', 'Mei', 'Sam'].map((name) => (
          <li
            key={name}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}
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
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span style={{ fontSize: 15, color: tokens.text }}>{name}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.text,
            border: `1.5px solid ${tokens.border}`,
            borderRadius: 6,
            padding: '3px 10px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {tokens.receiptCount}
        </span>
      </div>
    </>
  );
}

const BALANCES = [
  { rank: 1, name: 'Priya', amount: '42.00', size: 19, amountSize: 20 },
  { rank: 2, name: 'Tom', amount: '28.50', size: 16, amountSize: 16 },
  { rank: 3, name: 'Mei', amount: '19.25', size: 16, amountSize: 16 },
] as const;

function BalancesStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
        {tokens.balancesHeader}
      </div>
      <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
        {BALANCES.map((debt) => (
          <li
            key={debt.name}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '11px 0',
              borderBottom: `1px dashed ${tokens.border}`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}
              >
                #{debt.rank}
              </span>
              <span style={{ fontWeight: 500, color: tokens.text, fontSize: debt.size }}>
                {debt.name}
              </span>
            </span>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: tokens.danger,
                fontSize: debt.amountSize,
              }}
            >
              ${debt.amount}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function SettleStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <>
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
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
              #1
            </span>
            <span style={{ fontWeight: 500, fontSize: 17, color: tokens.text }}>Priya</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 20,
                color: tokens.success,
              }}
            >
              $42.00
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: tokens.success,
                border: `1px solid ${tokens.success}`,
                borderRadius: 999,
                padding: '2px 8px',
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
    </>
  );
}

function PaymentStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
        </li>
        <li
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0 0',
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
            <span style={{ color: tokens.muted, textDecoration: 'line-through' }}>$28.50</span>
            <span style={{ fontWeight: 600, color: tokens.success }}>$0.00</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

const RANKED = [
  { rank: 1, name: 'Priya', amount: '$42.00', tag: true, settled: false },
  { rank: 2, name: 'Tom', amount: '$28.50', tag: false, settled: false },
  { rank: 3, name: 'Mei', amount: '$19.25', tag: false, settled: false },
  { rank: 4, name: 'Sam', amount: '', tag: false, settled: true },
] as const;

function RankedStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: tokens.muted, letterSpacing: '0.04em' }}>
        WHO OWES
      </div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        {RANKED.map((row) => (
          <li
            key={row.name}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 0',
              borderBottom: `1px dashed ${tokens.border}`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}
              >
                #{row.rank}
              </span>
              <span
                style={{
                  fontWeight: 500,
                  color: row.settled ? tokens.muted : tokens.text,
                  fontSize: 17,
                }}
              >
                {row.name}
              </span>
              {row.rank === 1 ? (
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
              {row.tag ? (
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
                  {tokens.overdueWeeks}
                </span>
              ) : null}
            </span>
            {row.settled ? (
              <span style={{ fontSize: 13, fontWeight: 500, color: tokens.success }}>
                {tokens.settledLabel}
              </span>
            ) : (
              <span
                style={{
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: tokens.danger,
                  fontSize: 20,
                }}
              >
                {row.amount}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const FAVORITES = [
  { name: 'Ramen Ya', width: '82%', visits: '12', favorite: true },
  { name: 'Pho Corner', width: '55%', visits: '7', favorite: false },
  { name: 'Café Luna', width: '34%', visits: '4', favorite: false },
] as const;

function FavoriteStatic({ tokens }: { readonly tokens: SceneTokenProps }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {FAVORITES.map((spot) => (
        <li key={spot.name} style={{ padding: '9px 0' }}>
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
                fontWeight: spot.favorite ? 600 : 500,
                color: spot.favorite ? tokens.text : tokens.muted,
              }}
            >
              {spot.name}
            </span>
            <span
              style={{
                fontSize: 13,
                color: spot.favorite ? tokens.success : tokens.muted,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {spot.visits}
            </span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: tokens.border }}>
            <div
              style={{
                width: spot.width,
                height: '100%',
                borderRadius: 999,
                background: spot.favorite ? tokens.success : tokens.muted,
                opacity: spot.favorite ? 1 : 0.55,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
