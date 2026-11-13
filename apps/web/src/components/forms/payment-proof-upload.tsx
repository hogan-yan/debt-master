/**
 * PaymentProofUpload component for uploading and managing payment proof files
 * Extracted from PaymentForm for single-responsibility
 */

import {
  Archive,
  CheckCircle,
  Eye,
  Loader2,
  Receipt,
  RefreshCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { useImageProcessor } from '@/hooks';
import { m } from '@/paraglide/messages';
import { getPaymentProofUrlByPaymentId } from '@/server/payments';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { fileNameOrEmpty, fileSizeMbLabel, optimizationLabel } from './image-optimization-label';
import { PaymentProofModal } from './payment-proof-modal';

interface PaymentProofUploadProps {
  paymentId?: number | undefined;
  hasExistingPaymentProof?: boolean | undefined;
  proofFile: File | null;
  existingProofUrl: string | null;
  keepExistingProof: boolean;
  showExistingProof: boolean;
  onProofFileChange: (file: File | null) => void;
  onExistingProofUrlChange: (url: string | null) => void;
  onKeepExistingProofChange: (keep: boolean) => void;
  onHadExistingProofChange: (had: boolean) => void;
  onShowExistingProofChange: (show: boolean) => void;
  onProcessingChange?: ((processing: boolean) => void) | undefined;
}

export const PaymentProofUpload: React.FC<PaymentProofUploadProps> = ({
  paymentId,
  hasExistingPaymentProof,
  proofFile,
  existingProofUrl,
  keepExistingProof,
  showExistingProof,
  onProofFileChange,
  onExistingProofUrlChange,
  onKeepExistingProofChange,
  onHadExistingProofChange,
  onShowExistingProofChange,
  onProcessingChange,
}) => {
  const imageProcessor = useImageProcessor({
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
  });

  // Sync processing state with parent so submit button can be disabled
  useEffect(() => {
    onProcessingChange?.(imageProcessor.isProcessing);
  }, [imageProcessor.isProcessing, onProcessingChange]);

  // Fetch existing payment proof URL when editing
  // biome-ignore lint/correctness/useExhaustiveDependencies: callbacks are stable from reducer dispatch
  useEffect(() => {
    if (paymentId && hasExistingPaymentProof) {
      getPaymentProofUrlByPaymentId({ data: { paymentId } })
        .then((proofData) => {
          if (proofData.url) {
            onExistingProofUrlChange(proofData.url);
            onHadExistingProofChange(true);
          }
        })
        .catch((_error) => {});
    }
  }, [paymentId, hasExistingPaymentProof]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const processedFile = await imageProcessor.processFile(file);
      if (processedFile) {
        onProofFileChange(processedFile);
      }
    } else {
      const allowedTypes = ['application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(m.expense_form_invalidFileType());
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(m.payment_modal_fileTooLarge());
        return;
      }
      onProofFileChange(file);
    }
  };

  const removeFile = (): void => {
    onProofFileChange(null);
    if (existingProofUrl) onKeepExistingProofChange(true);
  };

  const removeExistingProof = (): void => onKeepExistingProofChange(false);
  const viewExistingProof = (): void => onShowExistingProofChange(true);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="payment-proof">{m.payment_form_paymentProofLabel()}</Label>
        {existingProofUrl && keepExistingProof && !proofFile && (
          <div className="border rounded-lg p-4 bg-info/10 border-info/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-info" />
                <span className="text-sm font-medium text-info">
                  {m.payment_form_existingProof()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={viewExistingProof}
                  className="text-info hover:text-info/80 p-1"
                  aria-label={m.payment_form_viewProofAria()}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeExistingProof}
                  className="text-destructive-text hover:text-destructive-text p-1"
                  aria-label={m.payment_form_removeProofAria()}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-info">{m.payment_form_keepProofDesc()}</p>
          </div>
        )}

        {(!existingProofUrl || !keepExistingProof || proofFile) && (
          <div className="border-2 border-dashed border-input rounded-lg p-4">
            {!proofFile && !imageProcessor.isProcessing ? (
              <div className="text-center">
                <input
                  id="payment-proof"
                  type="file"
                  accept="image/*,image/heic,image/heif,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={imageProcessor.isProcessing}
                />
                <label
                  htmlFor="payment-proof"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="text-muted-foreground mb-2">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {existingProofUrl
                      ? m.payment_form_uploadNewProof()
                      : m.payment_form_uploadProof()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.payment_form_supportedFormatsProof()}
                  </p>
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {m.expense_form_autoCompress()}
                  </p>
                </label>
              </div>
            ) : imageProcessor.isProcessing ? (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-info" />
                  <span className="text-sm font-medium text-info">
                    {m.expense_form_processingImage()}
                  </span>
                </div>
                <Progress value={imageProcessor.progress} className="h-2 mb-2" />
                <p className="text-xs text-info">
                  {imageProcessor.progress < 40
                    ? m.expense_form_converting()
                    : m.expense_form_compressing()}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm font-medium text-foreground">
                    {fileNameOrEmpty(proofFile)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({fileSizeMbLabel(proofFile)} MB)
                  </span>
                  {imageProcessor.result && (
                    <span className="text-xs text-success bg-success/15 px-2 py-1 rounded flex items-center gap-1">
                      {imageProcessor.result.wasConverted && <RefreshCcw className="h-3 w-3" />}
                      {imageProcessor.result.wasCompressed && <Archive className="h-3 w-3" />}
                      {optimizationLabel(
                        imageProcessor.result.wasConverted,
                        imageProcessor.result.wasCompressed,
                        ` ${m.expense_form_optimized()}`
                      )}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-destructive-text hover:text-destructive-text"
                >
                  {m.common_remove()}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentProofModal
        isOpen={showExistingProof}
        proofUrl={existingProofUrl ?? ''}
        onClose={() => onShowExistingProofChange(false)}
      />
    </>
  );
};
