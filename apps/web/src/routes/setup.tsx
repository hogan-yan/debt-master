import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import { createFirstAdmin } from '@/server/setup';
import { getSetupConfig } from '@/server/setup-config';
import { SETUP } from '@/test/test-ids';
import { betterAuthClient } from '@/utils/better-auth-client';
import { PASSWORD_REQUIREMENTS, validatePassword } from '@/utils/password-policy';

type SetupStatus = 'checking' | 'required' | 'unavailable';

type SetupFormValues = {
  name: string;
  email: string;
  password: string;
  setupToken: string;
};

export const Route = createFileRoute('/setup')({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: 'First-run setup — Debt Master' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
});

function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus>('checking');
  const [tokenRequired, setTokenRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getSetupConfig();
        if (cancelled) return;
        setStatus(config.setupRequired ? 'required' : 'unavailable');
        setTokenRequired(config.tokenRequired);
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once setup is no longer required, bounce to the login page.
  useEffect(() => {
    if (status === 'unavailable') {
      navigate({ to: '/login/' });
    }
  }, [status, navigate]);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess: () => {
      // Full reload so the AuthContext re-resolves with the new session cookie.
      window.location.href = '/';
    },
    successTitle: 'Admin account created',
    successMessage: 'Signed in and ready to go.',
  });

  const handleCreate = async (values: SetupFormValues) => {
    await handleSubmit(async () => {
      const result = await createFirstAdmin({ data: values });
      if (!result.success) throw new Error(result.error);

      const { error } = await betterAuthClient.signIn.email({
        email: values.email,
        password: values.password,
      });
      if (error) throw new Error(error.message ?? 'Automatic sign-in failed');
    }, 'Admin account created and signed in.');
  };

  const validateNameField = ({ value }: { value: string }) =>
    value.trim().length > 0 ? undefined : 'Name is required';

  const validateEmailField = ({ value }: { value: string }) => {
    if (!value) return 'Email is required';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email';
  };

  const validatePasswordField = ({ value }: { value: string }) => {
    if (!value) return 'Password is required';
    const result = validatePassword(value);
    return result.valid ? undefined : `${result.errors.join('. ')}.`;
  };

  const validateSetupTokenField = ({ value }: { value: string }) => {
    if (tokenRequired && !value.trim()) return 'Setup token is required';
    return undefined;
  };

  if (status !== 'required') {
    return (
      <div className="flex items-center justify-center min-h-96" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full h-full items-center justify-center pt-10 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2" data-testid={SETUP.HEADING}>
          Create your admin account
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          This one-time step sets up the first admin for your Debt Master instance.
        </p>

        <Card>
          <CardContent className="mt-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 mb-4 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Complete this now on a trusted network. After the first admin is created, this page
                locks permanently.
              </p>
            </div>

            <Form<SetupFormValues>
              defaultValues={{ name: '', email: '', password: '', setupToken: '' }}
              onSubmit={handleCreate}
            >
              <div className="flex flex-col gap-4">
                <FormInput
                  name="name"
                  label="Your name"
                  placeholder="Admin"
                  data-testid={SETUP.NAME_INPUT}
                  required
                  validate={validateNameField}
                />
                <FormInput
                  name="email"
                  type="email"
                  label="Admin email"
                  placeholder="admin@example.com"
                  data-testid={SETUP.EMAIL_INPUT}
                  required
                  validate={validateEmailField}
                />
                <FormInput
                  name="password"
                  type="password"
                  label="Password"
                  placeholder={`At least ${PASSWORD_REQUIREMENTS[0]?.label.split(' ')[2]} characters`}
                  data-testid={SETUP.PASSWORD_INPUT}
                  required
                  validate={validatePasswordField}
                />
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {PASSWORD_REQUIREMENTS.map((req) => (
                    <li key={req.label}>{req.label}</li>
                  ))}
                </ul>
                {tokenRequired && (
                  <FormInput
                    name="setupToken"
                    label="Setup token"
                    placeholder="Enter the token from your environment"
                    data-testid={SETUP.SETUP_TOKEN_INPUT}
                    required
                    validate={validateSetupTokenField}
                  />
                )}
                <FormSubmit data-testid={SETUP.SUBMIT_BTN} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create admin account'
                  )}
                </FormSubmit>
              </div>
            </Form>

            <div className="mt-4 text-center">
              <Button
                variant="link"
                className="h-auto p-0 text-sm text-muted-foreground"
                onClick={() => navigate({ to: '/login/' })}
              >
                Back to login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
