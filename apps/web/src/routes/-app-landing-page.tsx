import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { TornEdge } from '@/components/landing/torn-edge';
import { useTheme } from '@/hooks';
import { m } from '@/paraglide/messages';
import { APP_URL } from '@/utils/app-url';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '@/utils/store-urls';

/**
 * Public landing page for the Debt Master mobile app at /app (DEBTM-200
 * design language: radical restraint, one face, tabular figures; the
 * personality lives in the copy). Deliberately a different pitch from / —
 * the web page sells self-hosting to teams, this one sells the phone app
 * to groups of friends. No remotion here: every card is static CSS, so the
 * page stays cheap and the store CTAs stay the only moving part.
 *
 * Store URLs live in @/utils/store-urls and are empty until launch; the
 * CTA renders an honest coming-soon line instead of dead badges until then.
 */

// Same locked app.css tokens as the / landing (both themes; the canvases
// react to the theme toggle after mount).
const SCREEN_TOKENS: Record<
  'light' | 'dark',
  {
    surface: string;
    text: string;
    muted: string;
    border: string;
    danger: string;
    success: string;
  }
> = {
  light: {
    surface: 'hsl(0 0% 100%)',
    text: 'hsl(222.2 84% 4.9%)',
    muted: 'hsl(215.4 16.3% 42%)',
    border: 'hsl(214.3 31.8% 91.4%)',
    danger: 'hsl(0 76% 46%)',
    success: 'hsl(150 60% 32%)',
  },
  dark: {
    surface: 'hsl(0 0% 8%)',
    text: 'hsl(0 0% 88%)',
    muted: 'hsl(0 0% 59%)',
    border: 'hsl(0 0% 19%)',
    danger: 'hsl(0 85% 70%)',
    success: 'hsl(150 60% 55%)',
  },
};

type Tokens = (typeof SCREEN_TOKENS)['light'];

const STRIP = [
  () => m.app_landing_strip1(),
  () => m.app_landing_strip2(),
  () => m.app_landing_strip3(),
] as const;

const FAQS = [
  { question: () => m.app_landing_faq_q1(), answer: () => m.app_landing_faq_a1() },
  { question: () => m.app_landing_faq_q2(), answer: () => m.app_landing_faq_a2() },
  { question: () => m.app_landing_faq_q3(), answer: () => m.app_landing_faq_a3() },
  { question: () => m.app_landing_faq_q4(), answer: () => m.app_landing_faq_a4() },
] as const;

// Hero ledger sample data — same faces as the / landing so the two pages
// tell one story. Yen carries no decimals (mobile money keeps minor units
// per currency).
const OWED_ROWS = [
  { name: 'Mei', amount: '¥4,200' },
  { name: 'Priya', amount: '€18.60' },
  { name: 'Tom', amount: '$42.00' },
] as const;

function rowStyle(tokens: Tokens): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px dashed ${tokens.border}`,
  };
}

function nameStyle(tokens: Tokens): CSSProperties {
  return { fontWeight: 500, color: tokens.text, fontSize: 16, whiteSpace: 'nowrap' };
}

function amountStyle(tokens: Tokens): CSSProperties {
  return {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: tokens.danger,
    fontSize: 16,
  };
}

function buildFaqJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question(),
      acceptedAnswer: { '@type': 'Answer', text: faq.answer() },
    })),
  });
}

function buildAppJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Debt Master',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'iOS, Android',
    url: `${APP_URL}/app`,
    image: `${APP_URL}/og-image.png`,
    description: m.app_landing_meta_description(),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

/**
 * Store CTAs. With URLs empty (pre-launch) the buttons would be dead links,
 * so the CTA collapses to the coming-soon line; filling a URL in
 * @/utils/store-urls is the entire launch flip.
 */
function StoreCta(props: { readonly className?: string }) {
  if (!APP_STORE_URL && !GOOGLE_PLAY_URL) {
    return (
      <p className={`text-sm text-muted-foreground ${props.className ?? ''}`}>
        {m.app_landing_coming_soon()}
      </p>
    );
  }
  const pill =
    'bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90';
  return (
    <div className={`flex flex-wrap items-center gap-4 ${props.className ?? ''}`}>
      {APP_STORE_URL ? (
        <a
          href={APP_STORE_URL}
          className={`${pill} transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
        >
          {m.app_landing_app_store_cta()}
        </a>
      ) : null}
      {GOOGLE_PLAY_URL ? (
        <a
          href={GOOGLE_PLAY_URL}
          className={`${pill} transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
        >
          {m.app_landing_play_store_cta()}
        </a>
      ) : null}
    </div>
  );
}

/** Phone silhouette with the group ledger on screen — static, both themes. */
function PhoneMock({ tokens }: { readonly tokens: Tokens }) {
  return (
    <figure
      aria-label={m.app_landing_phone_aria()}
      className="w-[270px] rounded-[2.5rem] border border-border bg-[hsl(0_0%_12%)] p-2 shadow-card lg:rotate-2 hover:rotate-0 transition-transform"
    >
      <div
        style={{ background: tokens.surface }}
        className="rounded-[2rem] overflow-hidden px-5 py-6 aspect-[9/17] flex flex-col"
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text }}>
            {m.app_landing_screen_group()}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: tokens.muted }}>
            {m.app_landing_screen_meta()}
          </div>
        </div>
        <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
          {OWED_ROWS.map((row) => (
            <li key={row.name} style={rowStyle(tokens)}>
              <span style={nameStyle(tokens)}>{row.name}</span>
              <span style={amountStyle(tokens)}>{row.amount}</span>
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
            <span style={{ fontWeight: 500, color: tokens.muted, fontSize: 16 }}>
              {m.app_landing_screen_you()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: tokens.success }}>
              {m.app_landing_screen_settled()}
            </span>
          </li>
        </ul>
        <div className="mt-auto pt-4">
          <span
            style={{ background: 'hsl(173 80% 24%)', color: 'hsl(0 0% 100%)' }}
            className="inline-block px-4 py-2 rounded-full text-sm font-medium"
          >
            {m.app_landing_screen_button()}
          </span>
        </div>
      </div>
    </figure>
  );
}

/** Receipt-paper feature card with alternating tilt, mirroring the / steps. */
function FeatureCard(props: {
  readonly index: number;
  readonly tokens: Tokens;
  readonly children: ReactNode;
}) {
  const tilt = props.index % 2 === 0 ? 'lg:-rotate-1' : 'lg:rotate-1';
  return (
    <figure
      className={`border border-border shadow-card overflow-hidden ${tilt} hover:rotate-0 transition-transform`}
    >
      <TornEdge color={props.tokens.surface} />
      <div className="p-6" style={{ background: props.tokens.surface }}>
        {props.children}
      </div>
    </figure>
  );
}

function FeatureSection(props: {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly caption: string;
  readonly flip?: boolean;
  readonly tokens: Tokens;
  readonly children: ReactNode;
}) {
  const card = (
    <FeatureCard index={props.index} tokens={props.tokens}>
      <div style={{ color: props.tokens.text }}>{props.children}</div>
    </FeatureCard>
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
        {props.flip ? text : card}
        {props.flip ? card : text}
      </div>
    </section>
  );
}

export function AppLandingPage() {
  const { effectiveTheme } = useTheme();
  // Same hydration dance as /: SSR and first client render bake light
  // tokens; after mount the theme flips and the changed style props patch
  // the DOM in place.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const tokens = SCREEN_TOKENS[isMounted ? effectiveTheme : 'light'];

  return (
    <div className="max-w-5xl mx-auto" data-testid="app-landing-page">
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
            {m.app_landing_hero_title()}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            {m.app_landing_hero_subtitle()}
          </p>
          <StoreCta className="mt-8" />
          <p className="mt-6 text-sm text-muted-foreground">{m.app_landing_hero_proof()}</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PhoneMock tokens={tokens} />
        </div>
      </section>

      <section className="border-t border-border py-12">
        <ul className="flex flex-col sm:flex-row justify-center divide-y sm:divide-y-0 divide-x sm:divide-x-0 divide-border">
          {STRIP.map((item) => (
            <li
              key={item()}
              className="flex justify-center font-medium text-foreground sm:px-12 py-2 sm:py-0 first:pt-0 last:pb-0"
            >
              {item()}
            </li>
          ))}
        </ul>
      </section>

      <FeatureSection
        id="every-currency"
        index={0}
        title={m.app_landing_fx_title()}
        caption={m.app_landing_fx_caption()}
        tokens={tokens}
      >
        <div style={{ fontSize: 14, color: tokens.muted }}>{m.app_landing_screen_group()}</div>
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {OWED_ROWS.map((row) => (
            <li key={row.name} style={rowStyle(tokens)}>
              <span style={nameStyle(tokens)}>{row.name}</span>
              <span style={amountStyle(tokens)}>{row.amount}</span>
            </li>
          ))}
          <li
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 0 0',
            }}
          >
            <span style={{ fontSize: 13, color: tokens.muted }}>
              {m.app_landing_fx_card_total()}
            </span>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: tokens.text,
                fontSize: 18,
              }}
            >
              ≈ $96.40
            </span>
          </li>
        </ul>
      </FeatureSection>

      <FeatureSection
        id="receipt-scan"
        index={1}
        title={m.app_landing_scan_title()}
        caption={m.app_landing_scan_caption()}
        tokens={tokens}
        flip
      >
        <div style={{ fontSize: 14, color: tokens.muted }}>Izakaya Maru</div>
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {[
            { label: 'Ramen ×2', amount: '$28.00' },
            { label: 'Gyoza', amount: '$12.50' },
            { label: 'Sake', amount: '$18.00' },
          ].map((item) => (
            <li key={item.label} style={rowStyle(tokens)}>
              <span style={{ color: tokens.text, fontSize: 15 }}>{item.label}</span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: tokens.text,
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {item.amount}
              </span>
            </li>
          ))}
          <li
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 0 0',
            }}
          >
            <span style={{ fontSize: 13, color: tokens.muted }}>
              {m.app_landing_scan_card_total()}
            </span>
            <span
              style={{
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: tokens.text,
                fontSize: 18,
              }}
            >
              $58.50
            </span>
          </li>
        </ul>
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: tokens.success }}>
          ✓ {m.app_landing_scan_card_ready()}
        </div>
      </FeatureSection>

      <FeatureSection
        id="confirmed"
        index={2}
        title={m.app_landing_confirm_title()}
        caption={m.app_landing_confirm_caption()}
        tokens={tokens}
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <li style={rowStyle(tokens)}>
            <span style={nameStyle(tokens)}>Tom</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: tokens.muted,
                border: `1px solid ${tokens.border}`,
                borderRadius: 9999,
                padding: '2px 10px',
              }}
            >
              {m.app_landing_confirm_waiting()}
            </span>
            <span style={amountStyle(tokens)}>$42.00</span>
          </li>
          <li
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0 0',
            }}
          >
            <span style={nameStyle(tokens)}>Mei</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: tokens.success }}>
              {m.app_landing_confirm_confirmed()}
            </span>
            <span style={amountStyle(tokens)}>¥4,200</span>
          </li>
        </ul>
      </FeatureSection>

      <section aria-labelledby="app-landing-faq" className="border-t border-border py-16">
        <h2
          id="app-landing-faq"
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

      <section aria-labelledby="app-landing-cta" className="py-16 lg:py-24">
        <div className="relative">
          <TornEdge color="hsl(0 0% 8%)" />
          <div className="bg-[hsl(0_0%_8%)] px-8 py-16 text-center">
            <h2
              id="app-landing-cta"
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-[hsl(0_0%_88%)]"
            >
              {m.landing_cta_title()}
            </h2>
            <StoreCta className="mt-8 justify-center" />
            <a
              href="/"
              className="mt-6 block text-sm text-[hsl(0_0%_55%)] underline-offset-4 hover:text-[hsl(0_0%_88%)] hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
            >
              {m.app_landing_cross_link()}
            </a>
          </div>
          <TornEdge color="hsl(0 0% 8%)" flip />
        </div>
      </section>
    </div>
  );
}
