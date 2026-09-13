/**
 * Unified payment modal component
 * Allows colleagues to mark expenses as paid with optional payment proof and payment method selection
 */

import { Clock, Receipt, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { m } from '@/paraglide/messages';
import { claimPayment } from '@/server/expenses';
import { ExpenseParticipantWithColleague, PaymentType } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { optionalImagePreview } from './image-preview';
import {
  applyStringPreview,
  fileReaderEventResult,
  resetFileInputValue,
  runUnlessProcessing,
  withSelectedFile,
} from './payment-form-guards';

interface UnifiedPaymentModalProps {
  participant: ExpenseParticipantWithColleague;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmissionStart?: (() => void) | undefined;
  onSubmissionHandler?:
    | ((participantId: number, formData: FormData) => Promise<{ success: boolean }>)
    | undefined;
  isProcessing?: boolean | undefined;
}

/**
 * Modal component for marking payment as paid with optional proof and payment method selection
 */
export const UnifiedPaymentModal: React.FC<UnifiedPaymentModalProps> = ({
  participant,
  isOpen,
  onClose,
  onSuccess,
  onSubmissionStart,
  onSubmissionHandler,
  isProcessing = false,
}) => {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentType>('PAYME');

  /**
   * Handles file selection for payment proof
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    withSelectedFile(event.target.files, (file) => {
      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error(m.payment_modal_invalidFileType());
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(m.payment_modal_fileTooLarge());
        return;
      }

      setProofFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          applyStringPreview(fileReaderEventResult(e), setProofPreview);
        };
        reader.readAsDataURL(file);
      } else {
        setProofPreview(null);
      }
    });
  };

  /**
   * Removes the selected payment proof file
   */
  const removeProofFile = () => {
    setProofFile(null);
    setProofPreview(null);
    resetFileInputValue('unified-proof-upload');
  };

  /**
   * Handles form submission for marking payment as paid
   */
  const handleSubmit = async () => {
    await runUnlessProcessing(isProcessing, async () => {
      onSubmissionStart?.(); // Notify parent that submission is starting

      try {
        const formData = new FormData();
        formData.append('participantId', participant.id.toString());
        formData.append('paymentMethod', paymentMethod);

        if (proofFile) {
          formData.append('paymentProofFile', proofFile);
        }

        if (onSubmissionHandler) {
          // Use the external submission handler
          const result = await onSubmissionHandler(participant.id, formData);
          if (result.success) {
            onSuccess();
            handleClose();
          }
        } else {
          // Use the original internal submission logic
          await claimPayment({ data: formData });

          // Show success toast with undo functionality
          toast.success(m.payment_modal_claimSubmitted(), {
            description: m.payment_modal_claimPendingApproval(),
            action: {
              label: m.payment_modal_undo(),
              onClick: async () => {
                try {
                  const { undoClaim } = await import('@/server/expenses');
                  await undoClaim({ data: { participantId: participant.id, type: 'PENDING' } });
                  toast.success(m.payment_modal_claimCancelled());
                  // Call onSuccess again to refresh the data
                  onSuccess();
                } catch (_error) {
                  toast.error(m.payment_modal_cancelFailed());
                }
              },
            },
            duration: 10000, // Give more time to undo
          });

          onSuccess();
          handleClose();
        }
      } catch (_error) {
        toast.error(m.payment_modal_submitFailed());
      }
    });
  };

  /**
   * Handles modal close and resets state
   */
  const handleClose = () => {
    setProofFile(null);
    setProofPreview(null);
    setPaymentMethod('PAYME');
    onClose();
  };

  const paymentMethodOptions = [
    { value: 'PAYME', label: m.payment_modal_payme() },
    { value: 'FPS', label: m.payment_modal_fps() },
    { value: 'CASH', label: m.payment_modal_cash() },
    { value: 'OTHER', label: m.payment_modal_other() },
  ] as const;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" data-testid="unified-payment-modal">
        <DialogHeader>
          <DialogTitle>{m.payment_modal_title()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Details */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              {m.payment_modal_paymentAmount()}
            </div>
            <div className="text-xl font-semibold text-foreground">
              {formatCurrency(participant.amount)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {m.payment_modal_forName({ name: participant.colleague?.name || '' })}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{m.payment_modal_paymentMethod()}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentType)}
              className="grid grid-cols-2 gap-4 p-2"
            >
              {paymentMethodOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={option.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Payment Proof Upload (Optional) */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Receipt className="h-4 w-4" />
              {m.payment_modal_paymentProof()}
            </Label>
            <p className="text-sm text-muted-foreground">{m.payment_modal_proofDescription()}</p>

            {!proofFile ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <input
                  id="unified-proof-upload"
                  data-testid="unified-payment-proof-input"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="unified-proof-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {m.payment_modal_clickToUpload()}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {m.payment_modal_supportedFormats()}
                  </p>
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-foreground">{proofFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(proofFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeProofFile}
                    className="text-destructive-text hover:text-destructive-text p-1"
                    aria-label="Remove proof file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {optionalImagePreview(proofPreview, m.payment_modal_proofPreviewAlt())}

                {proofFile.type === 'application/pdf' && (
                  <div className="mt-3 p-3 bg-info/10 rounded border border-info/20">
                    <p className="text-sm text-info">{m.payment_modal_pdfSelected()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {m.common_cancel()}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="min-w-[120px]"
              data-testid="unified-payment-submit-btn"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 animate-spin mr-2" />
                  {m.payment_modal_submitting()}
                </>
              ) : (
                m.payment_modal_markAsPaid()
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
