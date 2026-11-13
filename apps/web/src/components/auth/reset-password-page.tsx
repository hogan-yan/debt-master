import { Link, useSearch } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import { resetPassword } from '@/server/password-reset';
import { AUTH } from '@/test/test-ids';
import { validatePassword } from '@/utils/password-policy';

type ResetPasswordSearch = {
  token?: string;
};

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

export const validatePasswordField = ({ value }: { value: string }) => {
  if (!value) return 'Password is required';
  const result = validatePassword(value);
  return result.valid ? undefined : `${result.errors.join('. ')}.`;
};

export const validateConfirmPasswordField = ({ value }: { value: string }) =>
  value ? undefined : 'Please confirm your password';

export function ResetPasswordPage() {
  const search = useSearch({ from: '/reset-password' }) as ResetPasswordSearch;
  const token = search.token ?? '';
  const [isDone, setIsDone] = useState(false);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    successTitle: 'Password updated',
    successMessage: 'Your password has been reset.',
  });

  const handleReset = async (values: ResetPasswordFormValues) => {
    if (values.password !== values.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    await handleSubmit(async () => {
      if (!token) throw new Error('Reset token is missing.');
      const result = await resetPassword({
        data: { token, password: values.password },
      });
      if (result?.success) {
        setIsDone(true);
      }
    }, 'Password reset successfully.');
  };

  return (
    <div className="flex flex-1 w-full h-full items-center justify-center pt-10 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2" data-testid={AUTH.LOGIN_HEADING}>
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Choose a strong password for your admin account.
        </p>

        <Card>
          <CardContent className="mt-4">
            {isDone ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. You can now sign in.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login/">Go to login</Link>
                </Button>
              </div>
            ) : (
              <Form<ResetPasswordFormValues>
                defaultValues={{ password: '', confirmPassword: '' }}
                onSubmit={handleReset}
              >
                <div className="flex flex-col gap-4">
                  <FormInput
                    name="password"
                    type="password"
                    label="New password"
                    data-testid={AUTH.RESET_PASSWORD_INPUT}
                    required
                    validate={validatePasswordField}
                  />
                  <FormInput
                    name="confirmPassword"
                    type="password"
                    label="Confirm new password"
                    data-testid={AUTH.RESET_PASSWORD_CONFIRM_INPUT}
                    required
                    validate={validateConfirmPasswordField}
                  />
                  <FormSubmit
                    data-testid={AUTH.RESET_PASSWORD_SUBMIT_BTN}
                    disabled={isSubmitting || !token}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      'Reset password'
                    )}
                  </FormSubmit>
                </div>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
