import { Link } from '@tanstack/react-router';
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { type KeyboardEvent } from 'react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import { COLLEAGUE_DETAIL, COMMON, NAV } from '@/test/test-ids';

export interface ColleagueHeaderBarProps {
  colleagueName: string;
  isAdmin: boolean;
  isEditing: boolean;
  editName: string;
  isSaving: boolean;
  onEditNameChange: (name: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRecordPayment: () => void;
  onDelete: () => void;
}

export function ColleagueHeaderBar({
  colleagueName,
  isAdmin,
  isEditing,
  editName,
  isSaving,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRecordPayment,
  onDelete,
}: ColleagueHeaderBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSaveEdit();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/colleagues/"
          data-testid={NAV.BACK_LINK}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label={m.colleague_detail_back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <EnhancedAvatar name={colleagueName} size="default" />
        {isEditing && isAdmin ? (
          <input
            type="text"
            data-testid={COLLEAGUE_DETAIL.EDIT_NAME_INPUT}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-xl font-semibold bg-background border border-input rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSaving}
            aria-label={m.colleague_detail_editNameInputAria()}
            // biome-ignore lint/a11y/noAutofocus: autofocus on edit input is intentional UX
            autoFocus
          />
        ) : (
          <span
            className="text-xl font-semibold"
            data-testid={COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT}
          >
            {colleagueName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isAdmin &&
          (isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelEdit}
                disabled={isSaving}
                data-testid={COMMON.CANCEL_BTN}
              >
                {m.common_cancel()}
              </Button>
              <Button
                size="sm"
                onClick={onSaveEdit}
                disabled={isSaving || !editName.trim()}
                data-testid={COLLEAGUE_DETAIL.SAVE_BTN}
              >
                {isSaving ? m.restaurant_detail_saving() : m.common_save()}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={onRecordPayment}
                data-testid={COLLEAGUE_DETAIL.RECORD_PAYMENT_HEADER_BTN}
              >
                {m.colleague_detail_recordPayment()}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onStartEdit}
                aria-label={m.colleague_detail_editNameAria()}
                data-testid={COLLEAGUE_DETAIL.EDIT_NAME_BTN}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={m.colleague_detail_moreActions()}
                    data-testid={COLLEAGUE_DETAIL.MORE_ACTIONS_BTN}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{m.colleague_detail_actions()}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive-text focus:text-destructive-text"
                    data-testid={COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {m.colleague_dialog_deactivateTitle()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ))}
      </div>
    </div>
  );
}
