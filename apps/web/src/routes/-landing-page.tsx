import { lazy, Suspense, useEffect, useState } from 'react';
import type { LedgerTokenProps } from '@/components/landing/ledger-hero';
import type { SceneIndex, SceneTokenProps } from '@/components/landing/ledger-scenes';
import { StepStatic } from '@/components/landing/scene-statics';
import { TornEdge } from '@/components/landing/torn-edge';
import { useTheme } from '@/hooks';
import { m } from '@/paraglide/messages';
import { APP_URL } from '@/utils/app-url';

/**
 * Public landing page for logged-out visitors (DEBTM-200 "Radical Restraint":
 * near-monochrome, one face, tabular figures as the hero; the personality
 * lives in the copy, not in chrome). One line of copy per beat, each beat
 * demonstrated by a small ledger animation — the product's own surface, not
 * decoration.
 */

// Pulled from the locked app.css tokens (docs/design-system.md) — both
// themes, so the canvases react to the theme toggle via inputProps.
const SCENE_TOKENS: Record<'light' | 'dark', SceneTokenProps> = {
  light: {
    surface: 'hsl(0 0% 100%)',
    text: 'hsl(222.2 84% 4.9%)',
    muted: 'hsl(215.4 16.3% 42%)',
    border: 'hsl(214.3 31.8% 91.4%)',
    danger: 'hsl(0 76% 46%)',
    success: 'hsl(150 60% 32%)',
    caption: m.landing_ledger_title(),
    outstandingLabel: m.landing_ledger_outstandingLabel(),
    settledLabel: m.landing_ledger_settledLabel(),
    receiptCount: m.landing_receipt_count(),
    overdueWeeks: m.landing_overdue_weeks(),
    balancesHeader: m.landing_scene_balances(),
    afterSettlementHeader: m.landing_scene_after(),
    paidLine: m.landing_payment_paidLine(),
    confirmedLabel: m.landing_payment_confirmed(),
  },
  dark: {
    surface: 'hsl(0 0% 8%)',
    text: 'hsl(0 0% 88%)',
    muted: 'hsl(0 0% 59%)',
    border: 'hsl(0 0% 19%)',
    danger: 'hsl(0 85% 70%)',
    success: 'hsl(150 60% 55%)',
    caption: m.landing_ledger_title(),
    outstandingLabel: m.landing_ledger_outstandingLabel(),
    settledLabel: m.landing_ledger_settledLabel(),
    receiptCount: m.landing_receipt_count(),
    overdueWeeks: m.landing_overdue_weeks(),
    balancesHeader: m.landing_scene_balances(),
    afterSettlementHeader: m.landing_scene_after(),
    paidLine: m.landing_payment_paidLine(),
    confirmedLabel: m.landing_payment_confirmed(),
  },
};

const LedgerHeroCard = lazy(() =>
  import('@/components/landing/ledger-hero').then((mod) => ({ default: mod.default }))
);

const StepSceneCard = lazy(() =>
  import('@/components/landing/ledger-scenes').then((mod) => ({ default: mod.default }))
);

// Mirrors the LedgerHero composition's end state (448x340 canvas, 1:1 scale)
// — it is the SSR/no-JS/reduced-motion surface; the Player upgrades it in
// place after hydration. Keep the two visually in sync.
function LedgerHeroStatic({ tokens }: { readonly tokens: LedgerTokenProps }) {
  return (
    <div
      role="img"
      aria-label={m.landing_ledger_aria()}
      style={{
        background: tokens.surface,
        padding: '22px 26px',
        fontFamily: "'Albert Sans', ui-sans-serif, system-ui, sans-serif",
        width: '100%',
        height: '100%',
      }}
    >
      <div style={{ fontSize: 14, color: tokens.muted }}>{tokens.caption}</div>
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
        $89.75
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
        {[
          { rank: 1, name: 'Priya', amount: '42.00' },
          { rank: 2, name: 'Tom', amount: '28.50' },
          { rank: 3, name: 'Mei', amount: '19.25' },
        ].map((debt) => (
          <li
            key={debt.name}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderBottom: `1px dashed ${tokens.border}`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{ fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}
              >
                #{debt.rank}
              </span>
              <span
                style={{
                  fontWeight: 500,
                  color: tokens.text,
                  fontSize: debt.rank === 1 ? 17 : 16,
                  whiteSpace: 'nowrap',
                }}
              >
                {debt.name}
              </span>
            </span>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: tokens.danger,
                fontSize: debt.rank === 1 ? 20 : 16,
              }}
            >
              ${debt.amount}
            </span>
          </li>
        ))}
        <li
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 0 0',
          }}
        >
          <span style={{ fontWeight: 500, color: tokens.muted, fontSize: 16 }}>Sam</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: tokens.success }}>
            {tokens.settledLabel}
          </span>
        </li>
      </ul>
    </div>
  );
}

// Three of the five former benefits survive as a one-line-each strip; the
// other two were demonstrated by the steps above instead of told.
const STRIP = [
  { key: 'landing_benefit1_title' as const, text: () => m.landing_benefit1_title() },
  { key: 'landing_benefit2_title' as const, text: () => m.landing_benefit2_title() },
  { key: 'landing_benefit4_title' as const, text: () => m.landing_benefit4_title() },
] as const;

const FAQS = [
  { question: () => m.landing_faq_q1(), answer: () => m.landing_faq_a1() },
  { question: () => m.landing_faq_q2(), answer: () => m.landing_faq_a2() },
  { question: () => m.landing_faq_q3(), answer: () => m.landing_faq_a3() },
  { question: () => m.landing_faq_q4(), answer: () => m.landing_faq_a4() },
  { question: () => m.landing_faq_q5(), answer: () => m.landing_faq_a5() },
  { question: () => m.landing_faq_q6(), answer: () => m.landing_faq_a6() },
] as const;

const STEP_CAPTIONS = [
  () => m.landing_step1_caption(),
  () => m.landing_step2_caption(),
  () => m.landing_step3_caption(),
] as const;

function buildFaqJsonLd(): string {
  const faqs = [
    { question: m.landing_faq_q1(), answer: m.landing_faq_a1() },
    { question: m.landing_faq_q2(), answer: m.landing_faq_a2() },
    { question: m.landing_faq_q3(), answer: m.landing_faq_a3() },
    { question: m.landing_faq_q4(), answer: m.landing_faq_a4() },
    { question: m.landing_faq_q5(), answer: m.landing_faq_a5() },
    { question: m.landing_faq_q6(), answer: m.landing_faq_a6() },
  ];
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  });
}

function buildAppJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Debt Master',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${APP_URL}/`,
    image: `${APP_URL}/og-image.png`,
    description: m.landing_meta_description(),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://opensource.org/licenses/MIT',
  });
}

function SceneSection(props: {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly index: SceneIndex;
  readonly tokens: SceneTokenProps;
  readonly flip?: boolean;
}) {
  const scene = (
    <figure className="w-full max-w-md border border-border rounded-lg shadow-card overflow-hidden">
      <div style={{ aspectRatio: '360 / 240' }}>
        <Suspense fallback={<StepStatic index={props.index} tokens={props.tokens} />}>
          <StepSceneCard
            index={props.index}
            tokens={props.tokens}
            staticFallback={<StepStatic index={props.index} tokens={props.tokens} />}
          />
        </Suspense>
      </div>
    </figure>
  );
  const text = (
    <div>
      <h2
        id={`${props.id}-title`}
        className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
      >
        {props.title}
      </h2>
      <p className="mt-3 text-lg text-muted-foreground max-w-md">{props.caption}</p>
    </div>
  );
  return (
    <section
      id={props.id}
      aria-labelledby={`${props.id}-title`}
      className="border-t border-border py-16"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
        {props.flip ? text : scene}
        {props.flip ? scene : text}
      </div>
    </section>
  );
}

export function LandingPage() {
  const { effectiveTheme } = useTheme();
  // SSR and the first client render both bake light tokens; hydration keeps
  // baked inline styles when no prop value changes, so after mount we flip
  // to the real theme — the changed style props force React to patch the DOM.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const tokens = SCENE_TOKENS[isMounted ? effectiveTheme : 'light'];

  return (
    <div className="max-w-5xl mx-auto" data-testid="landing-page">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data for search engines
        dangerouslySetInnerHTML={{ __html: buildAppJsonLd() }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data for search engines
        dangerouslySetInnerHTML={{ __html: buildFaqJsonLd() }}
      />

      <section className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-center py-12 lg:py-20">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
            {m.landing_hero_title()}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">{m.landing_hero_subtitle()}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <a
              href="/login"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {m.landing_hero_cta()}
            </a>
            <a
              href="#how-it-works"
              className="text-primary font-medium underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
            >
              {m.landing_hero_secondaryCta()}
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{m.landing_hero_proof()}</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <figure
            aria-label={m.landing_ledger_aria()}
            className="w-full max-w-md border border-border shadow-card overflow-hidden lg:-rotate-1"
          >
            <TornEdge color={tokens.surface} />
            <div style={{ aspectRatio: '448 / 340' }}>
              <Suspense fallback={<LedgerHeroStatic tokens={tokens} />}>
                <LedgerHeroCard
                  tokens={tokens}
                  staticFallback={<LedgerHeroStatic tokens={tokens} />}
                />
              </Suspense>
            </div>
          </figure>
        </div>
      </section>

      <section className="border-t border-border py-12">
        <ul className="flex flex-col sm:flex-row justify-center divide-y sm:divide-y-0 divide-x sm:divide-x-0 divide-border">
          {STRIP.map((item) => (
            <li
              key={item.key}
              className="flex justify-center font-medium text-foreground sm:px-12 py-2 sm:py-0 first:pt-0 last:pb-0"
            >
              {item.text()}
            </li>
          ))}
        </ul>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="landing-how"
        className="border-t border-border py-16"
      >
        <h2
          id="landing-how"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
        >
          {m.landing_how_title()}
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 list-none">
          {STEP_CAPTIONS.map((caption, index) => (
            <li key={caption()}>
              <figure
                className={`border border-border shadow-card overflow-hidden ${
                  index % 2 === 0 ? '-rotate-1' : 'rotate-1'
                } hover:rotate-0 transition-transform`}
              >
                <TornEdge color={tokens.surface} />
                <div style={{ aspectRatio: '360 / 240' }}>
                  <Suspense
                    fallback={<StepStatic index={(index + 1) as 1 | 2 | 3} tokens={tokens} />}
                  >
                    <StepSceneCard
                      index={(index + 1) as 1 | 2 | 3}
                      tokens={tokens}
                      staticFallback={
                        <StepStatic index={(index + 1) as 1 | 2 | 3} tokens={tokens} />
                      }
                    />
                  </Suspense>
                </div>
              </figure>
              {/* Step number sits outside the illustration card — figcaption is
                  invalid outside <figure>, and the caption must not inherit the
                  card's tilt. */}
              <p className="mt-4 text-sm font-medium text-foreground">
                {index + 1}. {caption()}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <SceneSection
        id="on-the-record"
        title={m.landing_payments_title()}
        caption={m.landing_payments_caption()}
        index={5}
        tokens={tokens}
        flip
      />

      <SceneSection
        id="ranked"
        title={m.landing_ranked_title()}
        caption={m.landing_ranked_caption()}
        index={6}
        tokens={tokens}
      />

      <SceneSection
        id="favorite"
        title={m.landing_favorite_title()}
        caption={m.landing_favorite_caption()}
        index={7}
        tokens={tokens}
        flip
      />

      <section aria-labelledby="landing-faq" className="border-t border-border py-16">
        <h2
          id="landing-faq"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
        >
          {m.landing_faq_title()}
        </h2>
        <div className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
          {FAQS.map((faq) => (
            <details key={faq.question()} className="group py-5">
              <summary className="cursor-pointer list-none font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm after:float-right after:content-['+'] after:text-muted-foreground group-open:after:content-['−']">
                {faq.question()}
              </summary>
              <p className="mt-2 text-muted-foreground">{faq.answer()}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-cta" className="py-16 lg:py-24">
        <div className="relative">
          <TornEdge color="hsl(0 0% 8%)" />
          <div className="bg-[hsl(0_0%_8%)] px-8 py-16 text-center">
            <h2
              id="landing-cta"
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-[hsl(0_0%_88%)]"
            >
              {m.landing_cta_title()}
            </h2>
            <a
              href="/login"
              className="mt-8 inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {m.landing_cta_button()}
            </a>
            <a
              href="/app"
              className="mt-4 block text-sm text-[hsl(0_0%_55%)] underline-offset-4 hover:text-[hsl(0_0%_88%)] hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
            >
              {m.landing_cta_appLink()}
            </a>
          </div>
          <TornEdge color="hsl(0 0% 8%)" flip />
        </div>
      </section>
    </div>
  );
}
