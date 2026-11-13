import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { m } from '@/paraglide/messages';
import {
  formatFileSize,
  type ImageProcessingOptions,
  isHEICFile,
  processImageFile,
  validateImageFile,
} from '@/utils/image-processor';

/**
 * State for image processing
 */
interface ImageProcessingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: {
    processedFile: File;
    wasConverted: boolean;
    wasCompressed: boolean;
    originalSize: number;
    finalSize: number;
  } | null;
}

/**
 * Hook for processing images with progress tracking
 */
export const useImageProcessor = (options: ImageProcessingOptions = {}) => {
  const [state, setState] = useState<ImageProcessingState>({
    isProcessing: false,
    progress: 0,
    error: null,
    result: null,
  });

  const processFile = useCallback(
    async (file: File): Promise<File | null> => {
      // Reset state
      setState({
        isProcessing: true,
        progress: 0,
        error: null,
        result: null,
      });

      try {
        // Validate file first
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }

        // Show toast for HEIC files
        if (isHEICFile(file)) {
          toast.info(m.imageProcessor_converting(), {
            description: m.imageProcessor_convertingDesc(),
          });
        }

        // Process the image
        const result = await processImageFile(file, {
          ...options,
          onProgress: (progress) => {
            setState((prev) => ({
              ...prev,
              progress,
            }));
          },
        });

        // Show success message with details
        const messages: string[] = [];
        if (result.wasConverted) {
          messages.push(m.imageProcessor_converted());
        }
        if (result.wasCompressed) {
          const savedSize = result.originalSize - result.finalSize;
          const savedPercent = Math.round((savedSize / result.originalSize) * 100);
          messages.push(
            m.imageProcessor_compressed({
              percent: String(savedPercent),
              size: formatFileSize(savedSize),
            })
          );
        }

        if (messages.length > 0) {
          toast.success(m.imageProcessor_success(), {
            description: messages.join(' • '),
          });
        }

        // Update state with result
        setState({
          isProcessing: false,
          progress: 100,
          error: null,
          result,
        });

        return result.processedFile;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        setState({
          isProcessing: false,
          progress: 0,
          error: errorMessage,
          result: null,
        });

        toast.error(m.imageProcessor_failed(), {
          description: errorMessage,
        });

        return null;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  return {
    processFile,
    reset,
    isProcessing: state.isProcessing,
    progress: state.progress,
    error: state.error,
    result: state.result,
  };
};
