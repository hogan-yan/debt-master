import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { m } from '@/paraglide/messages';
import {
  createAccessCode,
  deactivateAccessCode,
  deleteAccessCode,
  reactivateAccessCode,
} from '@/server/auth';
import { formatDate } from '@/utils/formatters';

export interface AccessCode {
  id: number;
  code: string;
  isActive: boolean;
  createdAt: string | Date;
  lastUsed: string | Date | null;
  createdBy: string | null;
}

export async function deleteAccessCodeIfPresent(
  code: AccessCode | null,
  deleteCode: (input: { data: { id: number } }) => Promise<unknown>,
  onDeleted: () => void
): Promise<void> {
  if (!code) return;

  await deleteCode({ data: { id: code.id } });
  onDeleted();
}

interface AccessCodeManagerProps {
  initialAccessCodes: AccessCode[];
  onRefresh: () => void;
}

function generateRandomCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join(
    ''
  );
}

function formatAccessCodeDate(date: string | Date | null): string {
  if (!date) return m.settings_neverUsed();
  return formatDate(String(date));
}

export function AccessCodeManager({ initialAccessCodes, onRefresh }: AccessCodeManagerProps) {
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>(initialAccessCodes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<AccessCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Sync with loader data when it changes
  useEffect(() => {
    setAccessCodes(initialAccessCodes);
  }, [initialAccessCodes]);

  const handleOpenModal = () => {
    setNewCode(generateRandomCode());
    setIsModalOpen(true);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(m.settings_codeCopied());
    } catch {
      toast.error(m.settings_copyFailed());
    }
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      await createAccessCode({
        data: { code: newCode.trim() },
      });
      toast.success(m.settings_codeCreated());
      setIsModalOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.settings_createCodeFailed());
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (code: AccessCode) => {
    try {
      if (code.isActive) {
        await deactivateAccessCode({ data: { id: code.id } });
        toast.success(m.settings_codeDeactivated());
      } else {
        await reactivateAccessCode({ data: { id: code.id } });
        toast.success(m.settings_codeActivated());
      }
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.settings_updateCodeFailed());
    }
  };

  const handleDeleteCode = async () => {
    setIsDeleting(true);
    try {
      await deleteAccessCodeIfPresent(codeToDelete, deleteAccessCode, () => {
        toast.success(m.settings_codeDeleted());
        setCodeToDelete(null);
        onRefresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.settings_updateCodeFailed());
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      accessorKey: 'code',
      header: m.settings_col_code(),
      cell: ({ row }: { row: { original: AccessCode } }) => {
        const code = row.original.code;
        return (
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{code}</code>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleCopyCode(code)}
              aria-label={`Copy code ${code}`}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: m.settings_col_status(),
      cell: ({ row }: { row: { original: AccessCode } }) => {
        const isActive = row.original.isActive;
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? m.settings_active() : m.settings_inactive()}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: m.settings_col_createdAt(),
      cell: ({ row }: { row: { original: AccessCode } }) =>
        formatAccessCodeDate(row.original.createdAt),
    },
    {
      accessorKey: 'lastUsed',
      header: m.settings_col_lastUsed(),
      cell: ({ row }: { row: { original: AccessCode } }) =>
        formatAccessCodeDate(row.original.lastUsed),
    },
    {
      accessorKey: 'createdBy',
      header: m.settings_col_createdBy(),
      cell: ({ row }: { row: { original: AccessCode } }) => row.original.createdBy || '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: AccessCode } }) => {
        const code = row.original;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={code.isActive}
              onCheckedChange={() => handleToggleStatus(code)}
              aria-label={code.isActive ? 'Deactivate code' : 'Activate code'}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive-text hover:text-destructive-text"
              onClick={() => setCodeToDelete(code)}
              aria-label={`Delete code ${code.code}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold" data-testid="access-codes-heading">
            {m.settings_accessCodes_title()}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {m.settings_accessCodes_description()}
          </p>
        </div>
        <Button onClick={handleOpenModal} data-testid="generate-code-btn">
          <Plus className="h-4 w-4 mr-2" />
          {m.settings_generateCode()}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {accessCodes.length === 0 ? (
            <EmptyStateWithAction
              title={m.settings_emptyStateTitle()}
              description={m.settings_emptyStateDescription()}
              actionText={m.settings_generateCode()}
              onAction={handleOpenModal}
              icon={<KeyRound className="h-12 w-12 text-muted-foreground" />}
            />
          ) : (
            <DataTable
              columns={columns}
              data={accessCodes}
              pagination={true}
              pageSize={5}
              filtering={false}
              sorting={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Generate Code Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent data-testid="generate-code-modal">
          <DialogHeader>
            <DialogTitle data-testid="generate-code-modal-title">
              {m.settings_generateCodeModalTitle()}
            </DialogTitle>
            <DialogDescription>
              A random code has been generated. You can use it or enter your own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{m.settings_customCodeLabel()}</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder={m.settings_customCodePlaceholder()}
                  minLength={4}
                  className="font-mono"
                  data-testid="new-code-input"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyCode(newCode)}
                  aria-label="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCode}
              disabled={isCreating || newCode.trim().length < 4}
              data-testid="create-code-btn"
            >
              {isCreating ? 'Creating...' : m.settings_createCode()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={codeToDelete !== null} onOpenChange={(open) => !open && setCodeToDelete(null)}>
        <DialogContent data-testid="delete-code-modal">
          <DialogHeader>
            <DialogTitle>{m.settings_deleteCodeTitle()}</DialogTitle>
            <DialogDescription>{m.settings_deleteCodeConfirm()}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
              {codeToDelete?.code}
            </code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeToDelete(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCode}
              disabled={isDeleting}
              data-testid="confirm-delete-code-btn"
            >
              {isDeleting ? 'Deleting...' : m.common_delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
