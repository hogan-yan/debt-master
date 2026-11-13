import { Link } from '@tanstack/react-router';
import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import { sendPasswordResetEmail } from '@/server/password-reset';
import { AUTH } from '@/test/test-ids';

type ForgotPasswordFormValues = {
  email: string;
};

export const validateEmailField = ({ value }: { value: string }) => {
  if (!value) return 'Email is required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email';
};

export function ForgotPasswordPage() {
  const [isSent, setIsSent] = useState(false);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    successTitle: 'Reset email sent',
    successMessage: 'Check your inbox for the reset link.',
  });

  const handleSend = async (values: ForgotPasswordFormValues) => {
    await handleSubmit(async () => {
      const result = await sendPasswordResetEmail({ data: values });
      if (result?.success) {
        setIsSent(true);
      }
    }, 'If this account exists, a reset email has been sent.');
  };

  return (
    <div className="flex flex-1 w-full h-full items-center justify-center pt-10 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1
          className="text-2xl font-bold text-center mb-2"
          data-testid={AUTH.FORGOT_PASSWORD_HEADING}
        >
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Enter your admin email and we will send you a link to reset your password.
        </p>

        <Card>
          <CardContent className="mt-4">
            {isSent ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Mail className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm text-muted-foreground">
                  If an account exists for this email, you will receive a reset link shortly.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login/">Back to login</Link>
                </Button>
              </div>
            ) : (
              <Form<ForgotPasswordFormValues> defaultValues={{ email: '' }} onSubmit={handleSend}>
                <div className="flex flex-col gap-4">
                  <FormInput
                    name="email"
                    type="email"
                    label="Admin email"
                    placeholder="admin@example.com"
                    data-testid={AUTH.FORGOT_PASSWORD_EMAIL_INPUT}
                    required
                    validate={validateEmailField}
                  />
                  <FormSubmit data-testid={AUTH.FORGOT_PASSWORD_SUBMIT_BTN} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </FormSubmit>
                </div>
              </Form>
            )}

            {!isSent && (
              <div className="mt-4 text-center">
                <Button asChild variant="link" className="h-auto p-0 text-sm text-muted-foreground">
                  <Link to="/login/">Back to login</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
