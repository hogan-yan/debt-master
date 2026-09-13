/**
 * Custom hook for handling form submissions with loading states and error handling
 */

import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

interface UseFormSubmissionOptions {
  onSuccess?: (data?: unknown) => void | Promise<void>;
  onError?: (error: unknown) => void;
  shouldRefresh?: boolean;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
}

export const useFormSubmission = (options: UseFormSubmissionOptions = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    onSuccess,
    onError,
    shouldRefresh = true,
    successTitle = 'Success',
    successMessage = 'Operation completed successfully',
    errorTitle = 'Error',
    errorMessage = 'An error occurred while processing your request',
  } = options;

  const handleSubmit = async <T>(
    submitFunction: () => Promise<T>,
    customSuccessMessage?: string,
    customErrorMessage?: string
  ): Promise<T | null> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitFunction();

      // Show success toast with Sonner
      toast.success(customSuccessMessage || successMessage, {
        description: successTitle !== 'Success' ? successTitle : undefined,
      });

      // Await so async callbacks (e.g. router.invalidate()) complete before
      // the hook's own refresh fires.
      if (onSuccess) {
        await onSuccess(result);
      }

      // Refresh data if needed
      if (shouldRefresh) {
        await router.invalidate();
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : customErrorMessage || errorMessage;
      setError(errorMsg);

      // Show error toast with Sonner
      toast.error(errorMsg, {
        description: errorTitle !== 'Error' ? errorTitle : undefined,
      });

      // Call custom error handler
      if (onError) {
        onError(err);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setIsSubmitting(false);
    setError(null);
  };

  return {
    isSubmitting,
    error,
    handleSubmit,
    reset,
  };
};
