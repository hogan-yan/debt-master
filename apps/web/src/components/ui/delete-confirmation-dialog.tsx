import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { COMMON } from '@/test/test-ids';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string | ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  'data-testid'?: string;
  confirmButtonTestId?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  isLoading = false,
  'data-testid': testid,
  confirmButtonTestId,
}: DeleteConfirmationDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid={testid}>
        <DialogHeader>
          <DialogTitle>{title ?? m.common_confirmDeletion()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-foreground">{message}</div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              data-testid={COMMON.CANCEL_BTN}
            >
              {cancelText ?? m.common_cancel()}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
              data-testid={confirmButtonTestId}
            >
              {confirmText ?? m.common_delete()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
