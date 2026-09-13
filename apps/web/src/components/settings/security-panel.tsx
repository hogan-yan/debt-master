import { Loader2, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import { changeAdminPassword } from '@/server/admin-security';
import { SECURITY } from '@/test/test-ids';
import { validatePassword } from '@/utils/password-policy';
import { TwoFactorSetup } from './two-factor-setup';

interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function SecurityPanel() {
  const { isSubmitting: isChangingPassword, handleSubmit } = useFormSubmission({
    successTitle: 'Password changed',
    successMessage: 'Your password has been updated.',
  });

  const handleChangePassword = async (values: ChangePasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      throw new Error('New passwords do not match');
    }
    await handleSubmit(async () => {
      await changeAdminPassword({
        data: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      });
    }, 'Password changed successfully.');
  };

  const validateNewPassword = ({ value }: { value: string }) => {
    if (!value) return 'New password is required';
    const result = validatePassword(value);
    return result.valid ? undefined : `${result.errors.join('. ')}.`;
  };

  const validateConfirmPassword = ({ value }: { value: string }) => {
    if (!value) return 'Please confirm your new password';
    return undefined;
  };

  const validateCurrentPassword = ({ value }: { value: string }) => {
    if (!value) return 'Current password is required';
    return undefined;
  };

  return (
    <div className="space-y-6" data-testid={SECURITY.PANEL}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change password */}
          <div className="space-y-4" data-testid={SECURITY.CHANGE_PASSWORD_FORM}>
            <h3 className="text-lg font-semibold">Change password</h3>
            <p className="text-sm text-muted-foreground">Update your admin password.</p>

            <Form<ChangePasswordFormValues>
              defaultValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
              onSubmit={handleChangePassword}
            >
              <div className="flex flex-col gap-4">
                <FormInput
                  name="currentPassword"
                  type="password"
                  label="Current password"
                  data-testid={SECURITY.CURRENT_PASSWORD_INPUT}
                  required
                  validate={validateCurrentPassword}
                />
                <FormInput
                  name="newPassword"
                  type="password"
                  label="New password"
                  data-testid={SECURITY.NEW_PASSWORD_INPUT}
                  required
                  validate={validateNewPassword}
                />
                <FormInput
                  name="confirmPassword"
                  type="password"
                  label="Confirm new password"
                  data-testid={SECURITY.CONFIRM_PASSWORD_INPUT}
                  required
                  validate={validateConfirmPassword}
                />
                <FormSubmit
                  data-testid={SECURITY.CHANGE_PASSWORD_SUBMIT_BTN}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Change password'
                  )}
                </FormSubmit>
              </div>
            </Form>
          </div>
        </CardContent>
      </Card>
      <TwoFactorSetup />
    </div>
  );
}
