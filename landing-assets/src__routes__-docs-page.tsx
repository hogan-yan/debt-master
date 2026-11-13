/**
 * User docs page (/docs) — how to use and self-host Debt Master, written for
 * the site visitor. Public, no auth. English only for now; the long-form
 * copy is not routed through Paraglide yet, so every locale prefix serves
 * this same page.
 */

const SECTIONS = [
  { id: 'what-is-debt-master', label: 'What is Debt Master?' },
  { id: 'roles', label: 'Roles' },
  { id: 'self-host', label: 'Self-host in five minutes' },
  { id: 'daily-use', label: 'Daily use' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'backup', label: 'Backups and upgrades' },
] as const;

function DocsNav() {
  return (
    <nav aria-label="On this page" className="sticky top-20 hidden md:block">
      <p className="text-sm font-semibold text-foreground">On this page</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#docs-${section.id}`} className="hover:text-foreground">
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section(props: {
  readonly id: string;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      id={`docs-${props.id}`}
      aria-labelledby={`docs-${props.id}-h`}
      className="border-t border-border py-10 first:border-t-0"
    >
      <h2
        id={`docs-${props.id}-h`}
        className="text-2xl font-semibold tracking-tight text-foreground"
      >
        {props.title}
      </h2>
      <div className="mt-4 space-y-4 text-muted-foreground">{props.children}</div>
    </section>
  );
}

const Command = ({ children }: { readonly children: React.ReactNode }) => (
  <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground">
    <code>{children}</code>
  </pre>
);

export function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl" data-testid="docs-page">
      <header className="py-12">
        <a
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to the home page
        </a>
        <p className="mt-6 text-sm font-medium text-primary">Docs</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          How to use Debt Master
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Everything a team needs to run Debt Master: what it does, how to self-host it, and the
          daily loop of logging expenses and settling up.
        </p>
      </header>

      <div className="grid gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
        <article className="min-w-0">
          <Section id="what-is-debt-master" title="What is Debt Master?">
            <p>
              Debt Master keeps one honest ledger for a team that shares costs — the office lunch
              tab, a flat's household spending, a club's trips. You record what was bought and who
              shares it; the app keeps the running balances and the payment history.
            </p>
            <p>
              A balance clears only after the payment is confirmed, so the numbers move only when
              the money is real.
            </p>
          </Section>

          <Section id="roles" title="Roles">
            <p>
              <strong className="text-foreground">Admins</strong> sign in with email and password
              (or Authentik, when the instance is configured for it). They manage colleagues, log
              expenses, and confirm payments.
            </p>
            <p>
              <strong className="text-foreground">Colleagues</strong> sign in with an access code an
              admin issues — no password. They see their own tab: what they owe, what they logged,
              and their payment history.
            </p>
          </Section>

          <Section id="self-host" title="Self-host in five minutes">
            <p>
              Debt Master is free and open source. One Docker Compose file brings up the app and its
              Postgres database.
            </p>
            <Command>{`git clone <repo-url> debt-master
cd debt-master
cp .env.example .env

# fill in the three required values in .env:
#   POSTGRES_PASSWORD, BETTER_AUTH_SECRET, JWT_SECRET
docker compose up -d`}</Command>
            <p>
              Open the app and the setup wizard creates your admin account. On public hosts, set{' '}
              <code className="text-foreground">SETUP_TOKEN</code> in{' '}
              <code className="text-foreground">.env</code> so only you can run the wizard. The full
              variable table lives in the repository's{' '}
              <code className="text-foreground">docs/DEPLOYMENT.md</code>.
            </p>
            <p>
              The bundle is lean on purpose: receipts persist on the container filesystem and the
              cache is in-process. MinIO, Valkey, and Authentik are configuration swaps, not extra
              services you must run.
            </p>
          </Section>

          <Section id="daily-use" title="Daily use">
            <p>
              <strong className="text-foreground">Add colleagues.</strong> Open{' '}
              <strong>Colleagues</strong>, create an entry, and share the access code it gives you.
              Colleagues enter the code on the login page.
            </p>
            <p>
              <strong className="text-foreground">Log an expense.</strong> Open{' '}
              <strong>Expenses</strong>, record what was bought, the total, and who shares it. The
              app splits the amount across the named people.
            </p>
            <p>
              <strong className="text-foreground">Settle up.</strong> When someone pays, record the
              payment against their balance. The balance clears when the payment is confirmed — the
              dashboard's ranked ledger always shows who still needs to pay.
            </p>
          </Section>

          <Section id="configuration" title="Configuration">
            <p>
              Every variable the app reads is listed in{' '}
              <code className="text-foreground">apps/web/.env.example</code> in the repository, with
              the default for each. The common ones:
            </p>
            <Command>{`PUBLIC_APP_URL=https://lunch.example.com   # public origin
SMTP_HOST=smtp.example.com               # optional: verification and reset email
STORAGE_PROVIDER=minio                   # optional: S3-compatible receipts
AUTH_PROVIDER=authentik                  # optional: OIDC admin sign-in`}</Command>
            <p>
              The interface ships in English, Japanese, and Traditional Chinese; the globe button in
              the header switches it.
            </p>
          </Section>

          <Section id="backup" title="Backups and upgrades">
            <p>
              Two things hold state: the Postgres database and the uploads directory. Back both up:
            </p>
            <Command>{`docker compose exec db pg_dump -U debtmaster debtmaster > backup.sql
docker compose cp app:/app/apps/web/storage ./storage-backup`}</Command>
            <p>
              Upgrades are <code className="text-foreground">docker compose pull</code> and{' '}
              <code className="text-foreground">up -d</code> — pending database migrations apply on
              startup.
            </p>
          </Section>

          <p className="border-t border-border pt-8 text-sm text-muted-foreground">
            More detail lives in the repository docs:{' '}
            <code className="text-foreground">docs/DEPLOYMENT.md</code> and{' '}
            <code className="text-foreground">docs/USAGE.md</code>.
          </p>
        </article>

        <aside>
          <DocsNav />
        </aside>
      </div>
    </div>
  );
}
