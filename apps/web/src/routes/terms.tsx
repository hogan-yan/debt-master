import { createFileRoute } from '@tanstack/react-router';
import { LEGAL_LAST_UPDATED, LegalPage, LegalSection } from './-legal-page';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
  head: () => ({
    meta: [{ title: 'Terms — Debt Master' }, { name: 'robots', content: 'noindex, follow' }],
  }),
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_LAST_UPDATED}>
      <LegalSection heading="1. The software">
        <p>
          Debt Master is open-source software (MIT-licensed) for tracking shared expenses. You use
          the version deployed by the operator of your instance; this page covers use of the
          software, not the operator's own house rules.
        </p>
      </LegalSection>
      <LegalSection heading="2. No warranty">
        <p>
          The software is provided "as is", without warranty of any kind. The authors are not liable
          for lost data, miscalculated balances, or any damages arising from its use. Keep backups
          of your database.
        </p>
      </LegalSection>
      <LegalSection heading="3. Your deployment, your responsibility">
        <p>
          Whoever operates an instance is responsible for its availability, its user accounts and
          access codes, the data stored on it, and complying with the laws that apply to them.
        </p>
      </LegalSection>
      <LegalSection heading="4. Acceptable use">
        <p>
          Don't use the software to track anything unlawful, and don't attack other people's
          deployments.
        </p>
      </LegalSection>
      <LegalSection heading="5. Contact">
        <p>
          Project contact:{' '}
          <a className="underline underline-offset-2" href="mailto:hogan.ywh@gmail.com">
            hogan.ywh@gmail.com
          </a>
          . Security reports: please follow the SECURITY policy in the project repository rather
          than opening public issues.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
