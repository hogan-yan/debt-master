import { createFileRoute } from '@tanstack/react-router';
import { LEGAL_LAST_UPDATED, LegalPage, LegalSection } from './-legal-page';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => ({
    // The landing at / is the only indexable surface, matching the other
    // public chrome pages.
    meta: [{ title: 'Privacy — Debt Master' }, { name: 'robots', content: 'noindex, follow' }],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_LAST_UPDATED}>
      <LegalSection heading="1. About this policy">
        <p>
          Debt Master is free, open-source software that you (or your organisation) host on your own
          infrastructure. This page describes what the software itself does with data. The person or
          organisation operating the instance you use is the controller of the data on that
          deployment and is responsible for its handling.
        </p>
      </LegalSection>
      <LegalSection heading="2. Where your data lives">
        <p>
          All workspace data — expenses, colleagues, restaurants, payments, receipts and other
          attachments — is stored in the database and file storage of the instance you use. The
          software does not send that data anywhere else.
        </p>
      </LegalSection>
      <LegalSection heading="3. No telemetry">
        <p>
          The software ships without third-party analytics, tracking, or advertising. Error
          reporting, if an operator enables it, is configured by that operator and pointed at
          infrastructure they control.
        </p>
      </LegalSection>
      <LegalSection heading="4. Accounts and access">
        <p>
          Administrators sign in with an email and password, with optional two-factor
          authentication. Colleagues sign in with access codes issued by an administrator. A session
          cookie keeps you signed in; language and theme preferences are stored in your browser.
        </p>
      </LegalSection>
      <LegalSection heading="5. Contact">
        <p>
          For data on an instance, contact the operator of that instance. For the software itself —
          including security reports — contact{' '}
          <a className="underline underline-offset-2" href="mailto:hogan.ywh@gmail.com">
            hogan.ywh@gmail.com
          </a>{' '}
          or open an issue on the project repository.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
