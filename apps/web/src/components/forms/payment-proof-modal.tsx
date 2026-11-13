import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';

interface PaymentProofModalProps {
  isOpen: boolean;
  proofUrl: string;
  onClose: () => void;
}

export function PaymentProofModal({ isOpen, proofUrl, onClose }: PaymentProofModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{m.payment_form_currentPaymentProof()}</DialogTitle>
          <DialogDescription>{m.payment_form_proofImageDesc()}</DialogDescription>
        </DialogHeader>
        <img
          src={proofUrl}
          alt={m.payment_form_existingProof()}
          className="w-full h-auto max-h-[70vh] object-contain rounded-lg border"
        />
        <div className="flex justify-end mt-4 gap-2">
          <Button onClick={() => window.open(proofUrl, '_blank')} variant="outline">
            {m.expense_detail_openInNewTab()}
          </Button>
          <Button onClick={onClose}>{m.common_close()}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
