/**
 * Two-factor (TOTP) setup for the admin account.
 *
 * Shown inside the security panel when Better Auth's two-factor plugin is
 * enabled. Lets the admin enable 2FA (showing a QR code and backup codes),
 * verify the first TOTP code to finalize setup, or disable an existing setup.
 */
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormSubmit } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-fields';
import { useFormSubmission } from '@/hooks';
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  verifyTwoFactorSetup,
} from '@/server/two-factor';
import { TWO_FACTOR } from '@/test/test-ids';

interface EnableFormValues {
  password: string;
}

interface VerifyFormValues {
  code: string;
}

interface DisableFormValues {
  password: string;
}

export function TwoFactorSetup() {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'unavailable'>(
    'loading'
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupResult, setSetupResult] = useState<{
    totpURI?: string;
    backupCodes?: string[];
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { handleSubmit: handleEnableSubmit, isSubmitting: isEnabling } = useFormSubmission({
    successTitle: '2FA enabled',
    successMessage: 'Scan the QR code with your authenticator app and enter a verification code.',
  });

  const { handleSubmit: handleVerifySubmit, isSubmitting: isVerifyingCode } = useFormSubmission({
    successTitle: '2FA verified',
    successMessage: 'Two-factor authentication is now active.',
  });

  const { handleSubmit: handleDisableSubmit, isSubmitting: isDisabling } = useFormSubmission({
    successTitle: '2FA disabled',
    successMessage: 'Two-factor authentication has been turned off.',
  });

  const loadStatus = useCallback(async () => {
    try {
      const result = await getTwoFactorStatus();
      setStatus(result.enabled ? 'enabled' : 'disabled');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (setupResult?.totpURI) {
      QRCode.toDataURL(setupResult.totpURI)
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [setupResult?.totpURI]);

  const handleEnable = async (values: EnableFormValues) => {
    await handleEnableSubmit(async () => {
      const result = await enableTwoFactor({ data: { password: values.password } });
      setSetupResult({
        totpURI: result.totpURI,
        backupCodes: result.backupCodes,
      });
      setIsVerifying(true);
      setShowBackupCodes(false);
    }, 'Two-factor authentication enabled.');
  };

  const handleVerify = async (values: VerifyFormValues) => {
    await handleVerifySubmit(async () => {
      await verifyTwoFactorSetup({ data: { code: values.code } });
      setIsVerifying(false);
      setStatus('enabled');
      setShowBackupCodes(true);
    }, 'Two-factor authentication is now active.');
  };

  const handleDisable = async (values: DisableFormValues) => {
    await handleDisableSubmit(async () => {
      await disableTwoFactor({ data: { password: values.password } });
      setSetupResult(null);
      setStatus('disabled');
      setShowBackupCodes(false);
    }, 'Two-factor authentication disabled.');
  };

  const validateCodeField = ({ value }: { value: string }) => {
    if (!value) return 'Verification code is required';
    if (!/^\d{6}$/.test(value)) return 'Enter a 6-digit code';
    return undefined;
  };

  if (status === 'loading') {
    return (
      <Card data-testid={TWO_FACTOR.SECTION}>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading two-factor status…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'unavailable') {
    // 2FA plugin not mounted (ENABLE_2FA != 'true'): render nothing rather
    // than advertise a feature this environment doesn't provide.
    return null;
  }

  const title = (
    <CardTitle className="flex items-center gap-2">
      {status === 'enabled' ? (
        <ShieldCheck className="h-5 w-5 text-green-600" />
      ) : (
        <ShieldOff className="h-5 w-5" />
      )}
      Two-factor authentication
    </CardTitle>
  );

  if (isVerifying) {
    return (
      <Card data-testid={TWO_FACTOR.SECTION}>
        <CardHeader>{title}</CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4" data-testid={TWO_FACTOR.STATUS_DISABLED}>
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app, then enter the 6-digit code to finish
              setup.
            </p>

            {qrDataUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Scan this QR code</p>
                <img
                  src={qrDataUrl}
                  alt="TOTP QR code"
                  className="h-48 w-48 rounded-md border"
                  data-testid={TWO_FACTOR.QR_CODE}
                />
              </div>
            )}

            <Form<VerifyFormValues>
              key="verify"
              defaultValues={{ code: '' }}
              onSubmit={handleVerify}
            >
              <div className="flex flex-col gap-4">
                <FormInput
                  name="code"
                  type="text"
                  label="Verification code"
                  placeholder="000000"
                  data-testid={TWO_FACTOR.VERIFY_CODE_INPUT}
                  required
                  validate={validateCodeField}
                />
                <FormSubmit data-testid={TWO_FACTOR.VERIFY_BTN} disabled={isVerifyingCode}>
                  {isVerifyingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    'Verify and enable 2FA'
                  )}
                </FormSubmit>
              </div>
            </Form>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={TWO_FACTOR.SECTION}>
      <CardHeader>{title}</CardHeader>
      <CardContent className="space-y-6">
        {status === 'enabled' ? (
          <div className="space-y-4" data-testid={TWO_FACTOR.STATUS_ENABLED}>
            <p className="text-sm text-green-700">Two-factor authentication is enabled.</p>

            {setupResult?.backupCodes && showBackupCodes && (
              <div className="space-y-2 rounded-md border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-medium text-yellow-900">Save these backup codes now</p>
                <ul
                  className="grid grid-cols-2 gap-2 font-mono text-xs text-yellow-800"
                  data-testid={TWO_FACTOR.BACKUP_CODES}
                >
                  {setupResult.backupCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBackupCodes(false)}
                >
                  Hide backup codes
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Disable 2FA</p>
              <p className="text-sm text-muted-foreground">
                Enter your current password to turn off two-factor authentication.
              </p>
              <Form<DisableFormValues>
                key="disable"
                defaultValues={{ password: '' }}
                onSubmit={handleDisable}
              >
                <div className="flex flex-col gap-4">
                  <FormInput
                    name="password"
                    type="password"
                    label="Current password"
                    data-testid={TWO_FACTOR.DISABLE_PASSWORD_INPUT}
                    required
                  />
                  <FormSubmit
                    data-testid={TWO_FACTOR.DISABLE_BTN}
                    disabled={isDisabling}
                    variant="destructive"
                  >
                    {isDisabling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disabling…
                      </>
                    ) : (
                      'Disable 2FA'
                    )}
                  </FormSubmit>
                </div>
              </Form>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid={TWO_FACTOR.STATUS_DISABLED}>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">2FA is not enabled</p>
              <p className="text-sm text-amber-800">
                Your admin password is the only thing protecting this instance. Enable two-factor
                authentication below to require a second factor at sign-in.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security by requiring a code from your authenticator app when
              you sign in.
            </p>

            <Form<EnableFormValues>
              key="enable"
              defaultValues={{ password: '' }}
              onSubmit={handleEnable}
            >
              <div className="flex flex-col gap-4">
                <FormInput
                  name="password"
                  type="password"
                  label="Current password"
                  description="Your password is required to enable two-factor authentication."
                  data-testid={TWO_FACTOR.ENABLE_PASSWORD_INPUT}
                  required
                />
                <FormSubmit data-testid={TWO_FACTOR.ENABLE_BTN} disabled={isEnabling}>
                  {isEnabling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enabling…
                    </>
                  ) : (
                    'Enable 2FA'
                  )}
                </FormSubmit>
              </div>
            </Form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
