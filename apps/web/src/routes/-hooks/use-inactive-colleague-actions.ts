import { useState } from 'react';
import { permanentDeleteColleague, restoreColleague } from '@/server/colleagues/handlers';
import type { InactiveColleagueWithBalance } from '@/types/colleague';

export interface UseInactiveColleagueActionsResult {
  isRestoreDialogOpen: boolean;
  colleagueToRestore: InactiveColleagueWithBalance | null;
  isPermanentDeleteDialogOpen: boolean;
  colleagueToPermanentDelete: InactiveColleagueWithBalance | null;
  setColleagueToRestore: (colleague: InactiveColleagueWithBalance | null) => void;
  setIsRestoreDialogOpen: (open: boolean) => void;
  setColleagueToPermanentDelete: (colleague: InactiveColleagueWithBalance | null) => void;
  setIsPermanentDeleteDialogOpen: (open: boolean) => void;
  handleRestore: () => Promise<void>;
  handlePermanentDelete: () => Promise<void>;
}

export function useInactiveColleagueActions(
  onSuccess: () => Promise<void>
): UseInactiveColleagueActionsResult {
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [colleagueToRestore, setColleagueToRestore] = useState<InactiveColleagueWithBalance | null>(
    null
  );
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [colleagueToPermanentDelete, setColleagueToPermanentDelete] =
    useState<InactiveColleagueWithBalance | null>(null);

  const handleRestore = async (): Promise<void> => {
    if (!colleagueToRestore) return;
    try {
      await restoreColleague({ data: { id: colleagueToRestore.id } });
      setIsRestoreDialogOpen(false);
      setColleagueToRestore(null);
      await onSuccess();
    } catch (_error) {}
  };

  const handlePermanentDelete = async (): Promise<void> => {
    if (!colleagueToPermanentDelete) return;
    try {
      await permanentDeleteColleague({
        data: { id: colleagueToPermanentDelete.id },
      });
      setIsPermanentDeleteDialogOpen(false);
      setColleagueToPermanentDelete(null);
      await onSuccess();
    } catch (_error) {}
  };

  return {
    isRestoreDialogOpen,
    colleagueToRestore,
    isPermanentDeleteDialogOpen,
    colleagueToPermanentDelete,
    setColleagueToRestore,
    setIsRestoreDialogOpen,
    setColleagueToPermanentDelete,
    setIsPermanentDeleteDialogOpen,
    handleRestore,
    handlePermanentDelete,
  };
}
