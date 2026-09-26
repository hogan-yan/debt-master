import { Loader2, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import { m } from '@/paraglide/messages';
import { changeAdminPassword } from '@/server/admin-security';
import { SECURITY } from '@/test/test-ids';
import { validatePassword } from '@/utils/password-policy';
import { TwoFactorSetup } from './two-factor-setup';

interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SecurityValidatorParams {
  value: string;
  fieldApi?: import('@tanstack/form-core').AnyFieldApi;
}

export const securityValidators = {
  currentPassword: ({ value }: SecurityValidatorParams): string | undefined =>
    value ? undefined : m.settings_changePassword_currentRequired(),
  newPassword: ({ value }: SecurityValidatorParams): string | undefined => {
    if (!value) return m.settings_changePassword_newRequired();
    const result = validatePassword(value);
    return result.valid ? undefined : `${result.errors.join('. ')}.`;
  },
  confirmPassword: ({ value, fieldApi }: SecurityValidatorParams): string | undefined => {
    if (!value) return m.settings_changePassword_confirmRequired();
    // AnyFieldApi's form generics are `unknown` here, so read the sibling value
    // through a minimal structural view (file-precedent cast, form.tsx:121).
    const newPassword: unknown = (
      fieldApi?.form as unknown as { getFieldValue: (name: string) => unknown } | undefined
    )?.getFieldValue('newPassword');
    if (typeof newPassword === 'string' && value !== newPassword) {
      return m.settings_changePassword_mismatch();
    }
    return undefined;
  },
} satisfies Record<string, (params: SecurityValidatorParams) => string | undefined>;

export function SecurityPanel() {
  const { isSubmitting: isChangingPassword, handleSubmit } = useFormSubmission({
    successTitle: m.settings_changePassword_successTitle(),
    successMessage: m.settings_changePassword_successDescription(),
  });

  const handleChangePassword = async (values: ChangePasswordFormValues): Promise<void> => {
    await handleSubmit(async () => {
      if (values.newPassword !== values.confirmPassword) {
        // Belt-and-braces: the field validator blocks this in the UI; if a
        // submit slips past canSubmit, surface it as a toast, never silently.
        throw new Error(m.settings_changePassword_mismatch());
      }
      await changeAdminPassword({
        data: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      });
    }, m.settings_changePassword_successToast());
  };

  return (
    <div className="space-y-6" data-testid={SECURITY.PANEL}>
      {/* Full-bleed form lines read badly at desktop; match the reset page's constraint */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {m.settings_security_title()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change password */}
          <div className="space-y-4" data-testid={SECURITY.CHANGE_PASSWORD_FORM}>
            <h3 className="text-lg font-semibold">{m.settings_changePassword_title()}</h3>
            <p className="text-sm text-muted-foreground">
              {m.settings_changePassword_description()}
            </p>

            <Form<ChangePasswordFormValues>
              defaultValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
              onSubmit={handleChangePassword}
            >
              <div className="flex flex-col gap-4">
                <FormInput
                  name="currentPassword"
                  type="password"
                  label={m.settings_changePassword_current()}
                  data-testid={SECURITY.CURRENT_PASSWORD_INPUT}
                  required
                  validate={securityValidators.currentPassword}
                />
                <FormInput
                  name="newPassword"
                  type="password"
                  label={m.settings_changePassword_new()}
                  data-testid={SECURITY.NEW_PASSWORD_INPUT}
                  required
                  validate={securityValidators.newPassword}
                />
                <FormInput
                  name="confirmPassword"
                  type="password"
                  label={m.settings_changePassword_confirm()}
                  data-testid={SECURITY.CONFIRM_PASSWORD_INPUT}
                  required
                  validate={securityValidators.confirmPassword}
                />
                <FormSubmit
                  data-testid={SECURITY.CHANGE_PASSWORD_SUBMIT_BTN}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {m.settings_changePassword_submitting()}
                    </>
                  ) : (
                    m.settings_changePassword_submit()
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
