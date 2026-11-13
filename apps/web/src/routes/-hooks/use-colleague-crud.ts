import { useState } from 'react';
import { useFormSubmission } from '@/hooks';
import { m } from '@/paraglide/messages';
import { createColleague, deleteColleague, updateColleague } from '@/server/colleagues/handlers';
import type { ColleagueForm as ColleagueFormData, ColleagueWithBalance } from '@/types';

export interface UseColleagueCRUDResult {
  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  selectedColleague: ColleagueWithBalance | null;
  isDeleteDialogOpen: boolean;
  colleagueToDelete: ColleagueWithBalance | null;
  setIsAddModalOpen: (open: boolean) => void;
  setIsEditModalOpen: (open: boolean) => void;
  handleEditClick: (colleague: ColleagueWithBalance) => void;
  handleDeleteClick: (colleague: ColleagueWithBalance) => void;
  handleAddColleague: (formData: ColleagueFormData) => Promise<void>;
  handleEditColleague: (formData: ColleagueFormData) => Promise<void>;
  confirmDelete: () => Promise<void>;
  setIsDeleteDialogOpen: (open: boolean) => void;
}

export function useColleagueCRUD(onSuccess: () => Promise<void>): UseColleagueCRUDResult {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedColleague, setSelectedColleague] = useState<ColleagueWithBalance | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [colleagueToDelete, setColleagueToDelete] = useState<ColleagueWithBalance | null>(null);

  const { handleSubmit } = useFormSubmission({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      void onSuccess();
    },
    successTitle: 'Success',
    errorTitle: 'Error',
  });

  const handleAddColleague = async (formData: ColleagueFormData): Promise<void> => {
    await handleSubmit(
      async () => {
        await createColleague({ data: { name: formData.name.trim() } });
        return { success: true };
      },
      m.colleague_toast_added({ name: formData.name.trim() })
    );
  };

  const handleEditColleague = async (formData: ColleagueFormData): Promise<void> => {
    if (!selectedColleague) return;

    await handleSubmit(
      async () => {
        await updateColleague({
          data: {
            id: selectedColleague.id,
            name: formData.name.trim(),
          },
        });
        return { success: true };
      },
      m.colleague_toast_updated({ name: formData.name.trim() })
    );
  };

  const handleEditClick = (colleague: ColleagueWithBalance): void => {
    setSelectedColleague(colleague);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (colleague: ColleagueWithBalance): void => {
    setColleagueToDelete(colleague);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!colleagueToDelete) return;

    await handleSubmit(
      async () => {
        await deleteColleague({
          data: { id: colleagueToDelete.id },
        });
        return { success: true };
      },
      m.colleague_toast_deleted({ name: colleagueToDelete.name })
    );

    setIsDeleteDialogOpen(false);
    setColleagueToDelete(null);
  };

  return {
    isAddModalOpen,
    isEditModalOpen,
    selectedColleague,
    isDeleteDialogOpen,
    colleagueToDelete,
    setIsAddModalOpen,
    setIsEditModalOpen,
    handleEditClick,
    handleDeleteClick,
    handleAddColleague,
    handleEditColleague,
    confirmDelete,
    setIsDeleteDialogOpen,
  };
}
