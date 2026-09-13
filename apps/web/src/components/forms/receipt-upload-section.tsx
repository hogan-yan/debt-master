/**
 * ReceiptUploadSection component for uploading and managing receipt files
 * Extracted from ExpenseForm for reusability
 */

import { Archive, Loader2, Receipt, RefreshCcw, Sparkles, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useImageProcessor } from '@/hooks';
import { m } from '@/paraglide/messages';
import { EXPENSE_FORM } from '@/test/test-ids';
import { Button } from '../ui/button';
import { optionalImagePreview } from '../ui/image-preview';
import { Label } from '../ui/label';
import { applyStringPreview, fileReaderEventResult } from '../ui/payment-form-guards';
import { Progress } from '../ui/progress';
import { optimizationLabel } from './image-optimization-label';

interface ReceiptUploadSectionProps {
  isEditing: boolean;
  initialExpenseId?: number;
  existingReceiptBucket?: string | null;
  existingReceiptObjectKey?: string | null;
  onReceiptChange: (file: File | null) => void;
  onKeepExistingChange: (keep: boolean) => void;
  onProcessingChange?: (processing: boolean) => void;
  onExistingUrlChange?: (url: string | null) => void;
}

export const ReceiptUploadSection: React.FC<ReceiptUploadSectionProps> = ({
  isEditing,
  initialExpenseId,
  existingReceiptBucket,
  existingReceiptObjectKey,
  onReceiptChange,
  onKeepExistingChange,
  onProcessingChange,
  onExistingUrlChange,
}) => {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [keepExistingReceipt, setKeepExistingReceipt] = useState(true);

  // Initialize image processor with compression settings
  const imageProcessor = useImageProcessor({
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
  });

  // Sync processing state with parent
  useEffect(() => {
    onProcessingChange?.(imageProcessor.isProcessing);
  }, [imageProcessor.isProcessing, onProcessingChange]);

  // Fetch existing receipt URL when editing
  useEffect(() => {
    const fetchExistingReceipt = async () => {
      if (isEditing && initialExpenseId && existingReceiptBucket && existingReceiptObjectKey) {
        try {
          const { getExpenseReceiptUrl } = await import('@/server/expenses');
          const receiptData = await getExpenseReceiptUrl({ data: { expenseId: initialExpenseId } });
          if (receiptData.url) {
            setExistingReceiptUrl(receiptData.url);
          }
        } catch (_error) {}
      }
    };

    fetchExistingReceipt();
  }, [isEditing, initialExpenseId, existingReceiptBucket, existingReceiptObjectKey]);

  // Notify parent when existing receipt URL changes
  useEffect(() => {
    onExistingUrlChange?.(existingReceiptUrl);
  }, [existingReceiptUrl, onExistingUrlChange]);

  // Notify parent when receipt file changes
  useEffect(() => {
    onReceiptChange(receiptFile);
  }, [receiptFile, onReceiptChange]);

  // Notify parent when keepExistingReceipt changes
  useEffect(() => {
    onKeepExistingChange(keepExistingReceipt);
  }, [keepExistingReceipt, onKeepExistingChange]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Only process image files, allow PDFs to pass through
    if (file.type.startsWith('image/')) {
      const processedFile = await imageProcessor.processFile(file);
      if (processedFile) {
        setReceiptFile(processedFile);

        // Create preview for processed image
        const reader = new FileReader();
        reader.onload = (e) => {
          applyStringPreview(fileReaderEventResult(e), setReceiptPreview);
        };
        reader.readAsDataURL(processedFile);
      }
    } else {
      // Handle non-image files (like PDFs) normally
      const allowedTypes = ['application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(m.expense_form_invalidFileType());
        return;
      }

      // Validate file size (max 10MB for PDFs)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(m.payment_modal_fileTooLarge());
        return;
      }

      setReceiptFile(file);
      setReceiptPreview(null); // No preview for PDFs
    }
  };

  const removeReceiptFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">
        <Receipt className="h-4 w-4" />
        {m.expense_form_receiptOptional()}
      </Label>

      {/* Show existing receipt if available */}
      {existingReceiptUrl && keepExistingReceipt && !receiptFile && (
        <div className="border rounded-lg p-4 bg-info/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-foreground">
                {m.expense_form_currentReceipt()}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setKeepExistingReceipt(false)}
              className="text-destructive-text hover:text-destructive-text p-1"
              aria-label={m.expense_form_removeExistingReceipt()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => window.open(existingReceiptUrl, '_blank')}
              className="block w-full text-left"
              aria-label={m.expense_form_clickToViewFullSize()}
            >
              <img
                src={existingReceiptUrl}
                alt={m.expense_form_currentReceipt()}
                className="max-w-full max-h-40 object-contain rounded border cursor-pointer"
              />
            </button>
          </div>

          <div className="mt-3 flex justify-between items-center">
            <p className="text-xs text-info">{m.expense_form_clickToViewFullSize()}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKeepExistingReceipt(false)}
            >
              {m.expense_form_changeReceipt()}
            </Button>
          </div>
        </div>
      )}

      {/* Show upload area if no existing receipt or user wants to change it */}
      {(!existingReceiptUrl || !keepExistingReceipt) && !receiptFile && (
        <div className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-muted-foreground transition-colors">
          <input
            id="receipt-upload"
            data-testid={EXPENSE_FORM.RECEIPT_UPLOAD_INPUT}
            type="file"
            accept="image/*,image/heic,image/heif,.pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={imageProcessor.isProcessing}
          />
          <label
            htmlFor="receipt-upload"
            className={`cursor-pointer ${imageProcessor.isProcessing ? 'opacity-50' : ''}`}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              {existingReceiptUrl
                ? m.expense_form_uploadNewReceipt()
                : m.expense_form_clickToUploadReceipt()}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.expense_form_supportedFormatsReceipt()}
            </p>
            <p className="text-xs text-success mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {m.expense_form_autoCompress()}
            </p>
          </label>
        </div>
      )}

      {/* Show image processing progress */}
      {imageProcessor.isProcessing && (
        <div className="border rounded-lg p-4 bg-info/10">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-info" />
            <span className="text-sm font-medium text-info">
              {m.expense_form_processingImage()}
            </span>
          </div>
          <Progress value={imageProcessor.progress} className="h-2" />
          <p className="text-xs text-info mt-1">
            {imageProcessor.progress < 40
              ? m.expense_form_converting()
              : m.expense_form_compressing()}
          </p>
        </div>
      )}

      {/* Show new receipt file if selected */}
      {receiptFile && !imageProcessor.isProcessing && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-foreground">{receiptFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(receiptFile.size / 1024 / 1024).toFixed(1)} MB)
              </span>
              {imageProcessor.result && (
                <span className="text-xs text-success bg-success/15 px-2 py-1 rounded flex items-center gap-1">
                  {imageProcessor.result.wasConverted && <RefreshCcw className="h-3 w-3" />}
                  {imageProcessor.result.wasCompressed && <Archive className="h-3 w-3" />}
                  {optimizationLabel(
                    imageProcessor.result.wasConverted,
                    imageProcessor.result.wasCompressed,
                    m.expense_form_optimized()
                  )}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeReceiptFile}
              className="text-destructive-text hover:text-destructive-text p-1"
              aria-label={m.expense_form_removeUploadedFile()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {optionalImagePreview(receiptPreview, m.expense_form_receiptPreviewAlt())}

          {receiptFile.type === 'application/pdf' && (
            <div className="mt-3 p-3 bg-info/10 rounded border border-info/20">
              <p className="text-sm text-info">{m.expense_form_pdfSelected()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
