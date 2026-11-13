/**
 * Payment proof upload modal component
 * Allows colleagues to mark expenses as paid with optional payment proof
 */

import { Clock, Receipt, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { m } from '@/paraglide/messages';
import { claimPayment } from '@/server/expenses';
import { ExpenseParticipantWithColleague, Payment } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { optionalImagePreview } from './image-preview';
import {
  applyStringPreview,
  fileReaderEventResult,
  resetFileInputValue,
  withSelectedFile,
} from './payment-form-guards';

interface PaymentProofModalProps {
  participant: ExpenseParticipantWithColleague;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isProcessing?: boolean;
}

interface PaymentProofViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentProofUrl: string | null;
  payment?: Payment | undefined;
}

/**
 * Modal component for viewing payment proof
 * @param isOpen - Whether the modal is open
 * @param onClose - Function to close the modal
 * @param paymentProofUrl - URL of the payment proof to display
 * @param payment - Optional payment data for context
 */
export const PaymentProofViewModal: React.FC<PaymentProofViewModalProps> = ({
  isOpen,
  onClose,
  paymentProofUrl,
  payment: _payment,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Payment Proof</DialogTitle>
        </DialogHeader>

        {paymentProofUrl && (
          <div className="space-y-4">
            <img
              src={paymentProofUrl}
              alt="Payment proof"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg border"
            />
            <div className="flex justify-end">
              <Button onClick={() => window.open(paymentProofUrl, '_blank')} variant="outline">
                Open in New Tab
              </Button>
            </div>
          </div>
        )}

        {!paymentProofUrl && (
          <div className="p-8 text-center text-muted-foreground">
            <p>Payment proof not found or failed to load.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/**
 * Modal component for uploading payment proof when marking expense as paid
 * @param participant - The expense participant data
 * @param isOpen - Whether the modal is open
 * @param onClose - Function to close the modal
 * @param onSuccess - Function called on successful submission
 * @param isProcessing - Whether the payment is being processed
 */
export const PaymentProofModal: React.FC<PaymentProofModalProps> = ({
  participant,
  isOpen,
  onClose,
  onSuccess,
  isProcessing = false,
}) => {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handles file selection for payment proof
   * @param event - File input change event
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
    resetFileInputValue('proof-upload');
  };

  /**
   * Handles form submission for marking payment as paid
   */
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('participantId', participant.id.toString());

      if (proofFile) {
        formData.append('paymentProofFile', proofFile);
      }

      await claimPayment({ data: formData });

      // Don't show toast here - parent component will handle it with undo functionality
      onSuccess();
      handleClose();
    } catch (_error) {
      toast.error(m.payment_modal_submitFailed());
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles modal close and resets state
   */
  const handleClose = () => {
    setProofFile(null);
    setProofPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Payment as Paid</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Details */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Payment Amount</div>
            <div className="text-xl font-semibold text-foreground">
              {formatCurrency(participant.amount)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              for {participant.colleague?.name}
            </div>
          </div>

          {/* Payment Proof Upload (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment Proof (optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Upload a screenshot of your bank transfer, digital payment, or other proof
            </p>

            {!proofFile ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <input
                  id="proof-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="proof-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to upload payment proof
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Supports: JPEG, PNG, WebP, PDF (max 10MB)
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
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {optionalImagePreview(proofPreview, 'Payment proof preview')}

                {proofFile.type === 'application/pdf' && (
                  <div className="mt-3 p-3 bg-info/10 rounded border border-info/20">
                    <p className="text-sm text-info">
                      PDF file selected. Preview will be available after upload.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isProcessing}
              className="bg-success hover:bg-success"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Mark as Paid'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
