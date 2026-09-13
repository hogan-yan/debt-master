import imageCompression from 'browser-image-compression';

/**
 * Configuration for image processing
 */
export interface ImageProcessingOptions {
  /**
   * Maximum file size in MB (default: 2MB)
   */
  maxSizeMB?: number;
  /**
   * Maximum width in pixels (default: 1920)
   */
  maxWidthOrHeight?: number;
  /**
   * Image quality for JPEG (0-1, default: 0.8)
   */
  initialQuality?: number;
  /**
   * Whether to use multi-threading for faster processing (default: true)
   */
  useWebWorker?: boolean;
  /**
   * Progress callback function
   */
  onProgress?: (progress: number) => void;
}

/**
 * Default image processing options
 */
const defaultOptions: Required<Omit<ImageProcessingOptions, 'onProgress'>> = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  useWebWorker: true,
};

/**
 * Check if we're running in the browser
 */
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Check if a file is a HEIC image
 */
export const isHEICFile = (file: File): boolean => {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
};

/**
 * Convert HEIC file to JPEG
 */
export const convertHEICToJPEG = async (file: File): Promise<File> => {
  // Only allow HEIC conversion in the browser
  if (!isBrowser()) {
    throw new Error('HEIC conversion is only available in the browser');
  }

  try {
    // Dynamically import heic2any only when needed
    const { default: heic2any } = await import('heic2any');

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    // heic2any can return single blob or array of blobs
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    if (!blob) {
      throw new Error('HEIC conversion returned empty result');
    }

    // Create a new file with JPEG extension
    const originalName = file.name.replace(/\.(heic|heif)$/i, '');
    const newFileName = `${originalName}_converted.jpg`;

    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (_error) {
    throw new Error('Failed to convert HEIC image. Please try a different image format.');
  }
};

/**
 * Compress image file
 */
export const compressImage = async (
  file: File,
  options: ImageProcessingOptions = {}
): Promise<File> => {
  const config = { ...defaultOptions, ...options };

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: config.maxSizeMB,
      maxWidthOrHeight: config.maxWidthOrHeight,
      initialQuality: config.initialQuality,
      useWebWorker: config.useWebWorker,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });

    // Preserve the original filename if the compressed file has a generic name
    if (
      compressedFile.name === 'blob' ||
      !compressedFile.name ||
      compressedFile.name.startsWith('image')
    ) {
      // Create a new File object with the original filename
      const preservedFile = new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: compressedFile.lastModified || Date.now(),
      });
      return preservedFile;
    }

    return compressedFile;
  } catch (_error) {
    throw new Error('Failed to compress image. Please try a different image.');
  }
};

/**
 * Process image file: convert HEIC if needed, then compress
 */
export const processImageFile = async (
  file: File,
  options: ImageProcessingOptions = {}
): Promise<{
  processedFile: File;
  wasConverted: boolean;
  wasCompressed: boolean;
  originalSize: number;
  finalSize: number;
}> => {
  const originalSize = file.size;
  const originalFileName = file.name;
  let currentFile = file;
  let wasConverted = false;
  let wasCompressed = false;

  // Update progress for conversion phase
  options.onProgress?.(10);

  // Step 1: Convert HEIC to JPEG if needed
  if (isHEICFile(file)) {
    currentFile = await convertHEICToJPEG(file);
    wasConverted = true;
    options.onProgress?.(40);
  }

  // Step 2: Compress image if it's an image file
  if (currentFile.type.startsWith('image/')) {
    try {
      const compressedFile = await compressImage(currentFile, {
        ...options,
        onProgress: (progress) => {
          // Map compression progress to 40-100% range
          const overallProgress = 40 + progress * 0.6;
          options.onProgress?.(overallProgress);
        },
      });

      // Only consider it compressed if the size actually decreased
      if (compressedFile.size < currentFile.size) {
        // Ensure the final file has a proper name
        let finalFileName = compressedFile.name;
        if (finalFileName === 'blob' || !finalFileName || finalFileName.startsWith('image')) {
          // Use original filename or current file name
          finalFileName = currentFile.name || originalFileName;
        }

        // Create final file with preserved filename
        const finalFile = new File([compressedFile], finalFileName, {
          type: compressedFile.type,
          lastModified: compressedFile.lastModified || Date.now(),
        });

        currentFile = finalFile;
        wasCompressed = true;
      }
    } catch (_error) {
      // Continue with uncompressed file rather than failing
    }
  }

  options.onProgress?.(100);

  return {
    processedFile: currentFile,
    wasConverted,
    wasCompressed,
    originalSize,
    finalSize: currentFile.size,
  };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

/**
 * Validate image file before processing
 */
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size (max 20MB — must match server-side file-validation.ts limit)
  if (file.size > 20 * 1024 * 1024) {
    return {
      isValid: false,
      error: 'File size must be less than 20MB',
    };
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  const isValidType =
    allowedTypes.includes(file.type) ||
    file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|heic|heif)$/);

  if (!isValidType) {
    return {
      isValid: false,
      error: 'Only JPEG, PNG, WebP, and HEIC images are supported',
    };
  }

  return { isValid: true };
};
