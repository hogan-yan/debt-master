/**
 * Warning modal for editing expenses with pending payment claims
 * Shows clear options for handling existing claims
 */

import { AlertTriangle, Clock, DollarSign, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { m } from '@/paraglide/messages';
import { formatCurrency, formatDateWithRelative } from '@/utils/formatters';

interface PendingClaim {
  id: number;
  amount: number;
  colleagueName: string;
  submittedAt: Date;
  hasPaymentProof: boolean;
}

interface ExpenseEditWarningModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Function called when user confirms their choice */
  onConfirm: (choice: 'keep' | 'cancel' | 'adjust') => void;
  /** Current expense amount */
  currentAmount: number;
  /** New expense amount */
  newAmount: number;
  /** List of pending payment claims */
  pendingClaims: PendingClaim[];
  /** Whether the confirmation is processing */
  isProcessing?: boolean;
}

type ChoiceOption = 'keep' | 'cancel' | 'adjust';

/**
 * Modal component that warns users about pending payment claims when editing expenses
 * Provides clear options for handling the claims
 */
export const ExpenseEditWarningModal = ({
  isOpen,
  onClose,
  onConfirm,
  currentAmount,
  newAmount,
  pendingClaims,
  isProcessing = false,
}: ExpenseEditWarningModalProps) => {
  const [selectedChoice, setSelectedChoice] = useState<ChoiceOption>('keep');

  const amountDifference = newAmount - currentAmount;
  const isIncrease = amountDifference > 0;
  const totalClaimedAmount = pendingClaims.reduce((sum, claim) => sum + claim.amount, 0);

  const getChoiceDescription = (choice: ChoiceOption) => {
    switch (choice) {
      case 'keep':
        return isIncrease
          ? m.expense_edit_warning_keepDescIncrease({ amount: formatCurrency(amountDifference) })
          : m.expense_edit_warning_keepDescDecrease({
              amount: formatCurrency(Math.abs(amountDifference)),
            });
      case 'cancel':
        return m.expense_edit_warning_cancelDesc();
      case 'adjust':
        return isIncrease
          ? m.expense_edit_warning_adjustDescIncrease()
          : m.expense_edit_warning_adjustDescDecrease();
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedChoice);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span>{m.expense_edit_warning_title()}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Situation Summary */}
          <Card className="border-warning/20 bg-warning/10">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-warning">
                    {m.expense_edit_warning_currentExpense()}
                  </span>
                  <span className="font-mono text-warning">{formatCurrency(currentAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-warning">
                    {m.expense_edit_warning_newExpense()}
                  </span>
                  <span className="font-mono text-warning">{formatCurrency(newAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-warning/20 pt-2">
                  <span className="font-medium text-warning">
                    {isIncrease
                      ? m.expense_edit_warning_increase()
                      : m.expense_edit_warning_decrease()}
                  </span>
                  <span
                    className={`font-mono font-bold ${isIncrease ? 'text-destructive-text' : 'text-success'}`}
                  >
                    {isIncrease ? '+' : ''}
                    {formatCurrency(amountDifference)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Claims Summary */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>{m.expense_edit_warning_pendingClaims({ count: pendingClaims.length })}</span>
            </h3>

            <div className="space-y-2">
              {pendingClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-3 bg-info/10 rounded-lg border border-info/20"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-info" />
                      <span className="font-medium text-info">{claim.colleagueName}</span>
                    </div>
                    <span className="text-sm text-info">
                      {m.expense_edit_warning_claimed()} {formatCurrency(claim.amount)}
                    </span>
                    {claim.hasPaymentProof && (
                      <span className="text-xs bg-info/10 text-info px-2 py-1 rounded">
                        {m.expense_edit_warning_proofAttached()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-info flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDateWithRelative(claim.submittedAt.toString())}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
              <span className="font-medium text-foreground">
                {m.expense_edit_warning_totalClaimed()}
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(totalClaimedAmount)}
              </span>
            </div>
          </div>

          {/* Choice Options */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground">{m.expense_edit_warning_howToHandle()}</h3>

            <RadioGroup
              value={selectedChoice}
              onValueChange={(value) => setSelectedChoice(value as ChoiceOption)}
            >
              <div className="space-y-3">
                {/* Keep as partial payments */}
                <label
                  htmlFor="keep"
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
                >
                  <RadioGroupItem value="keep" id="keep" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-foreground">
                      {isIncrease
                        ? m.expense_edit_warning_keepPartial()
                        : m.expense_edit_warning_keepOverpayment()}
                    </div>
                    <p className="text-sm text-muted-foreground">{getChoiceDescription('keep')}</p>
                  </div>
                </label>

                {/* Cancel pending claims */}
                <label
                  htmlFor="cancel"
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
                >
                  <RadioGroupItem value="cancel" id="cancel" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-foreground">
                      {m.expense_edit_warning_cancelAll()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getChoiceDescription('cancel')}
                    </p>
                  </div>
                </label>

                {/* Auto-adjust claims */}
                <label
                  htmlFor="adjust"
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
                >
                  <RadioGroupItem value="adjust" id="adjust" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-foreground">
                      {m.expense_edit_warning_autoAdjust()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getChoiceDescription('adjust')}
                    </p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
            {m.expense_edit_warning_cancelEdit()}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing
              ? m.expense_edit_warning_processing()
              : m.expense_edit_warning_continueEdit()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
