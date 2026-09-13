import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ActivityTab } from '@/components/colleague-detail/activity-tab/activity-tab';
import type { Transaction } from '@/components/colleague-detail/activity-tab/use-transaction-filter';
import {
  type ColleagueDetailTab,
  ColleagueDetailTabs,
} from '@/components/colleague-detail/colleague-detail-tabs';
import { ColleagueHeaderBar } from '@/components/colleague-detail/colleague-header-bar';
import { KpiStrip } from '@/components/colleague-detail/kpi-strip';
import { PaymentForm } from '@/components/forms/payment-form';
import { CRUDModalContainer } from '@/components/ui/crud-modal-container';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import type { CreatePaymentSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { getColleagueDetailMetrics } from '@/server/colleagues/colleague-detail';
import {
  deleteColleague,
  getActiveColleagues,
  getColleagueById,
  updateColleague,
} from '@/server/colleagues/handlers';
import { createPayment } from '@/server/payments';
import { COLLEAGUE_DETAIL } from '@/test/test-ids';
import type { Colleague } from '@/types';
import { PaymentForm as PaymentFormData } from '@/types';
import { isAuthError } from '@/utils/auth-client';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { formatDate } from '@/utils/formatters';
import { ProtectedRoute } from '@/utils/route-protection';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

interface LoaderData {
  colleague: Awaited<ReturnType<typeof getColleagueById>> | null;
  metrics: Awaited<ReturnType<typeof getColleagueDetailMetrics>>;
  colleagues: Colleague[];
}

const EMPTY_METRICS: Awaited<ReturnType<typeof getColleagueDetailMetrics>> = {
  totalOwed: 0,
  totalPaid: 0,
  currentBalance: 0,
  debtAgeDays: null,
  lastActivityDate: null,
  expenseCount: 0,
  paymentCount: 0,
  agingBuckets: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 },
};

export const Route = createFileRoute('/colleagues/$colleagueId')({
  component: ColleagueDetailPage,
  head: () => ({
    meta: [{ title: `${m.colleague_detail_pageTitle()} — Debt Master` }],
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const colleagueId = Number.parseInt(params.colleagueId, 10);

    if (Number.isNaN(colleagueId) || colleagueId <= 0) {
      throw redirect({ to: '/colleagues/' });
    }

    try {
      const [colleague, metrics, colleagues] = await Promise.all([
        getColleagueById({ data: { id: colleagueId } }),
        getColleagueDetailMetrics({ data: { colleagueId } }),
        getActiveColleagues(),
      ]);

      return { colleague, metrics, colleagues };
    } catch (error) {
      if (isAuthError(error)) {
        return { colleague: null, metrics: EMPTY_METRICS, colleagues: [] };
      }
      throw redirect({ to: '/colleagues/' });
    }
  },
  errorComponent: ({ error }) => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive-text mx-auto" />
        <h2 className="text-xl font-semibold">{m.colleague_detail_failedLoad()}</h2>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : m.colleague_detail_tryAgain()}
        </p>
        <Link to="/colleagues/" className="text-primary hover:underline">
          {m.colleague_detail_back()}
        </Link>
      </div>
    </div>
  ),
  pendingComponent: () => <ColleagueDetailSkeleton />,
});

function ColleagueDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Skeleton className="h-28 col-span-2" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function buildTransactions(colleague: NonNullable<LoaderData['colleague']>): Transaction[] {
  const fmt = (d: string | Date) => formatDate(typeof d === 'string' ? d : d.toISOString());

  return [
    ...(colleague.expenseParticipants?.map((ep) => ({
      type: 'expense' as const,
      id: ep.id,
      amount: ep.amount,
      date: ep.expense?.date ? new Date(ep.expense.date).toISOString() : new Date().toISOString(),
      description: ep.expense?.restaurant?.name || m.colleague_detail_unknownRestaurant(),
      details: ep.expense?.date ? fmt(ep.expense.date) : m.colleague_detail_unknownDate(),
    })) || []),
    ...(colleague.payments
      ?.filter((p) => p.isApproved)
      .map((p) => {
        const paymentNotes = 'notes' in p && typeof p.notes === 'string' ? p.notes : undefined;
        return {
          type: 'payment' as const,
          id: p.id,
          amount: p.amount,
          date: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
          description: m.colleague_detail_paymentDescription({ id: p.paymentType }),
          details: p.date ? fmt(p.date) : m.colleague_detail_unknownDate(),
          notes: paymentNotes,
        };
      }) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function ColleagueDetailPage() {
  const { colleague, metrics, colleagues } = Route.useLoaderData();
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(colleague?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ColleagueDetailTab>('activity');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const transactions = useMemo(() => (colleague ? buildTransactions(colleague) : []), [colleague]);

  const handleSaveEdit = async () => {
    if (!colleague || !editName.trim() || editName.trim() === colleague.name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateColleague({
        data: {
          id: colleague.id,
          name: editName.trim(),
        },
      });
      toast.success(m.colleague_detail_nameUpdated({ name: editName.trim() }));
      setIsEditing(false);
      router.invalidate();
    } catch (_error) {
      toast.error(m.colleague_detail_nameUpdateFailed());
      setEditName(colleague?.name ?? '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(colleague?.name ?? '');
  };

  const handleCreatePayment = async (formData: PaymentFormData) => {
    const form = new FormData();
    form.append('colleagueId', formData.colleagueId);
    form.append('amount', formData.amount);
    form.append('date', formData.date);
    form.append('paymentType', formData.paymentType);
    if (formData.paymentProofFile) {
      form.append('paymentProofFile', formData.paymentProofFile);
    }
    if (formData.selectedExpenseIds && formData.selectedExpenseIds.length > 0) {
      form.append('selectedExpenseIds', JSON.stringify(formData.selectedExpenseIds));
      form.append('expenseAmounts', JSON.stringify(formData.expenseAmounts || {}));
    }
    if (formData.expenseId) {
      form.append('expenseId', formData.expenseId.toString());
    }

    const result = await createPayment({ data: form });

    if (result.autoPayments && result.autoPayments.length > 0) {
      toast.success(m.colleague_detail_paymentRecordedAuto(), {
        description: m.colleague_detail_paymentRecordedAutoDesc(),
        duration: 5000,
      });
    } else {
      toast.success(m.colleague_detail_paymentRecorded());
    }

    setIsPaymentModalOpen(false);
    router.invalidate();
  };

  const handleDeleteConfirm = async () => {
    if (!colleague) return;
    try {
      await deleteColleague({
        data: { id: colleague.id },
      });
      toast.success(m.colleague_detail_deleted({ name: colleague.name }));
      setIsDeleteDialogOpen(false);
      await router.invalidate();
      router.navigate({ to: '/colleagues/' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.colleague_detail_deleteFailed());
    }
  };

  return (
    <ProtectedRoute hasSsrData={!!colleague}>
      <div className="space-y-6">
        <ColleagueHeaderBar
          colleagueName={colleague?.name ?? ''}
          isAdmin={isAdmin}
          isEditing={isEditing}
          editName={editName}
          isSaving={isSaving}
          onEditNameChange={setEditName}
          onStartEdit={() => setIsEditing(true)}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onRecordPayment={() => setIsPaymentModalOpen(true)}
          onDelete={() => setIsDeleteDialogOpen(true)}
        />

        <KpiStrip
          currentBalance={metrics.currentBalance}
          totalOwed={metrics.totalOwed}
          totalPaid={metrics.totalPaid}
          debtAgeDays={metrics.debtAgeDays}
          lastActivityDate={metrics.lastActivityDate}
        />

        <ColleagueDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          <ActivityTab
            transactions={transactions}
            onRecordPayment={isAdmin ? () => setIsPaymentModalOpen(true) : undefined}
          />
        </div>

        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            title={m.colleague_dialog_deactivateTitle()}
            message={m.colleague_dialog_deactivateMessage({ name: colleague?.name ?? '' })}
            confirmText={m.colleague_dialog_deactivateButton()}
            onConfirm={handleDeleteConfirm}
            data-testid={COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG}
            confirmButtonTestId="deactivate-btn"
          />
        </AdminOnly>

        {isAdmin && colleague && (
          <CRUDModalContainer
            isOpen={isPaymentModalOpen}
            onOpenChange={setIsPaymentModalOpen}
            title={m.colleague_detail_recordPayment()}
            maxWidth="lg"
            data-testid={COLLEAGUE_DETAIL.PAYMENT_DIALOG}
          >
            <PaymentForm
              colleagues={colleagues}
              onClose={() => setIsPaymentModalOpen(false)}
              onSubmit={handleCreatePayment satisfies (data: CreatePaymentSchema) => Promise<void>}
              initialData={{
                colleagueId: colleague.id.toString(),
              }}
            />
          </CRUDModalContainer>
        )}
      </div>
    </ProtectedRoute>
  );
}
