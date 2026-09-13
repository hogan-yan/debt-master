/**
 * Colleagues route - Manage colleague profiles and view balances
 */

import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { Archive, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ColleagueForm } from '@/components/forms/colleague-form';
import { ColleagueMobileCard } from '@/components/lists/colleague-mobile-card';
import { InactiveColleagueMobileCard } from '@/components/lists/inactive-colleague-mobile-card';
import { Button } from '@/components/ui/button';
import { CRUDModalContainer } from '@/components/ui/crud-modal-container';
import { DataTableWithActions } from '@/components/ui/data-table-with-actions';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { PageHeader } from '@/components/ui/page-header';
import { SummaryCardsGrid } from '@/components/ui/summary-cards-grid';
import { createColleagueColumns, createInactiveColleagueColumns } from '@/config/table-columns';
import { useSyncedRef } from '@/hooks';
import { m } from '@/paraglide/messages';
import type { ColleagueBalance } from '@/server/balance-calculator';
import { COLLEAGUE } from '@/test/test-ids';
import type { InactiveColleagueWithBalance } from '@/types/colleague';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { ProtectedRoute } from '@/utils/route-protection';
import type { ColleagueWithBalance } from '../types';
import { useActiveColleagueList } from './-hooks/use-active-colleague-list';
import { useColleagueCRUD } from './-hooks/use-colleague-crud';
import { useInactiveColleagueActions } from './-hooks/use-inactive-colleague-actions';
import { useInactiveColleagueList } from './-hooks/use-inactive-colleague-list';

type ColleagueListTab = 'active' | 'inactive';

const colleagueListTabs: Array<{
  id: ColleagueListTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'active', label: m.colleague_tab_active(), icon: Users },
  { id: 'inactive', label: m.colleague_tab_inactive(), icon: Archive },
];

function mergeWithBalances<T extends { id: number }>(
  items: T[],
  balances: ColleagueBalance[]
): (T & { currentBalance: number })[] {
  const balanceMap = new Map(balances.map((b) => [b.colleagueId, b.currentBalance]));
  return items.map((item) => ({
    ...item,
    currentBalance: balanceMap.get(item.id) ?? 0,
  }));
}

export const Route = createFileRoute('/colleagues')({
  component: ColleaguesPage,
  head: () => ({
    meta: [{ title: 'Colleagues — Debt Master' }],
  }),
  loader: async () => {
    // Lazy import server functions to avoid TDZ issues during build
    const { calculateAllColleagueBalances, getColleagueStatsFromCalculatedBalances } = await import(
      '@/server/balance-calculator'
    );
    const { getColleaguesPaginated } = await import('@/server/colleagues/handlers');

    const [paginatedColleagues, balances, stats] = await Promise.all([
      getColleaguesPaginated({
        data: {
          page: 1,
          pageSize: 10,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      }),
      calculateAllColleagueBalances({ data: undefined }),
      getColleagueStatsFromCalculatedBalances(),
    ]);

    return {
      paginatedColleagues: {
        ...paginatedColleagues,
        data: mergeWithBalances(paginatedColleagues.data, balances),
      },
      stats,
    };
  },
});

function ColleaguesPage() {
  const { isAdmin } = useAuth();
  const initialData = Route.useLoaderData();
  const hasSsrData =
    initialData.paginatedColleagues.data.length > 0 || initialData.stats.totalColleagues > 0;

  const [activeTab, setActiveTab] = useState<ColleagueListTab>('active');

  const {
    paginatedData,
    stats,
    summaryCards,
    isLoading,
    refreshColleagues,
    handlePaginationChange,
    handleSearchChange,
    handleSortChange,
  } = useActiveColleagueList(initialData.paginatedColleagues, initialData.stats);

  const {
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
  } = useColleagueCRUD(refreshColleagues);

  const {
    inactiveData,
    isInactiveLoading,
    inactiveListParams,
    fetchInactiveColleagues,
    handleInactivePaginationChange,
    handleInactiveSearchChange,
    handleInactiveSortChange,
  } = useInactiveColleagueList(activeTab === 'inactive');

  const inactiveListParamsRef = useSyncedRef(inactiveListParams);

  const handleInactiveActionsSuccess = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchInactiveColleagues(inactiveListParamsRef.current),
      refreshColleagues(),
    ]);
  }, [fetchInactiveColleagues, inactiveListParamsRef.current, refreshColleagues]);

  const {
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
  } = useInactiveColleagueActions(handleInactiveActionsSuccess);

  const handleTabChange = (tab: ColleagueListTab): void => {
    setActiveTab(tab);
    if (tab === 'inactive') {
      fetchInactiveColleagues(inactiveListParamsRef.current);
    }
  };

  const renderActiveMobileCard = (colleague: ColleagueWithBalance) => (
    <ColleagueMobileCard
      key={colleague.id}
      colleague={colleague}
      isAdmin={isAdmin}
      onAction={(action) => {
        if (action === 'edit') handleEditClick(colleague);
        if (action === 'delete') handleDeleteClick(colleague);
      }}
    />
  );

  const renderInactiveMobileCard = (colleague: InactiveColleagueWithBalance) => (
    <InactiveColleagueMobileCard
      key={colleague.id}
      colleague={colleague}
      onRestore={(col) => {
        setColleagueToRestore(col);
        setIsRestoreDialogOpen(true);
      }}
      onPermanentDelete={(col) => {
        setColleagueToPermanentDelete(col);
        setIsPermanentDeleteDialogOpen(true);
      }}
    />
  );

  // If a child route (e.g. /colleagues/$colleagueId) is active, render only the outlet
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/colleagues\/\d+\/?$/.test(pathname)) {
    return <Outlet />;
  }

  return (
    <ProtectedRoute hasSsrData={hasSsrData}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={m.colleague_pageTitle()}
          subtitle={m.colleague_pageSubtitle()}
          data-testid={COLLEAGUE.MANAGEMENT_HEADING}
          action={
            <AdminOnly>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                data-testid={COLLEAGUE.ADD_COLLEAGUE_BTN}
              >
                {m.colleague_addColleague()}
              </Button>
            </AdminOnly>
          }
        />

        {/* Summary Cards */}
        <SummaryCardsGrid cards={summaryCards} />

        {/* Active/Inactive Tabs (admin only) */}
        <AdminOnly>
          <div
            role="tablist"
            aria-label={m.colleague_aria_sections()}
            className="flex items-center gap-1 border-b border-border"
          >
            {colleagueListTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange(tab.id)}
                  data-testid={tab.id === 'active' ? 'active-tab' : 'inactive-tab'}
                  className="rounded-b-none"
                >
                  <TabIcon className="h-3 w-3 mr-1" />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </AdminOnly>

        {/* Active Colleagues Table */}
        {activeTab === 'active' && (
          <DataTableWithActions
            title={isAdmin ? m.colleague_table_management() : m.colleague_table_all()}
            columns={createColleagueColumns({
              onEdit: handleEditClick,
              onDelete: handleDeleteClick,
              isAdmin,
            })}
            data={paginatedData.data}
            pagination={paginatedData.pagination}
            onPaginationChange={handlePaginationChange}
            onSearchChange={handleSearchChange}
            onSortChange={handleSortChange}
            searchPlaceholder={m.colleague_search_placeholder()}
            searchUiVariant="expense"
            isLoading={isLoading}
            tableTestId="colleague-table"
            rowTestId="colleague-row"
            mobileCardView={true}
            renderMobileCard={renderActiveMobileCard}
            emptyStateComponent={
              stats.totalColleagues === 0 ? (
                <AdminOnly>
                  <EmptyStateWithAction
                    actionText={m.colleague_empty_addFirst()}
                    onAction={() => setIsAddModalOpen(true)}
                  />
                </AdminOnly>
              ) : null
            }
          />
        )}

        {/* Inactive Colleagues Table */}
        {activeTab === 'inactive' && (
          <DataTableWithActions
            title={m.colleague_table_inactive()}
            columns={createInactiveColleagueColumns({
              onRestore: (colleague) => {
                setColleagueToRestore(colleague);
                setIsRestoreDialogOpen(true);
              },
              onPermanentDelete: (colleague) => {
                setColleagueToPermanentDelete(colleague);
                setIsPermanentDeleteDialogOpen(true);
              },
            })}
            data={inactiveData.data}
            pagination={inactiveData.pagination}
            onPaginationChange={handleInactivePaginationChange}
            onSearchChange={handleInactiveSearchChange}
            onSortChange={handleInactiveSortChange}
            searchPlaceholder={m.colleague_searchInactive_placeholder()}
            searchUiVariant="expense"
            isLoading={isInactiveLoading}
            tableTestId="inactive-colleague-table"
            rowTestId="colleague-row"
            mobileCardView={true}
            renderMobileCard={renderInactiveMobileCard}
          />
        )}

        {/* Add Colleague Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isAddModalOpen}
            onOpenChange={setIsAddModalOpen}
            title={m.colleague_modal_addTitle()}
            maxWidth="md"
          >
            <ColleagueForm onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddColleague} />
          </CRUDModalContainer>
        </AdminOnly>

        {/* Edit Colleague Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            title={m.colleague_modal_editTitle()}
            maxWidth="md"
          >
            {selectedColleague && (
              <ColleagueForm
                initialData={{
                  name: selectedColleague.name,
                }}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditColleague}
              />
            )}
          </CRUDModalContainer>
        </AdminOnly>

        {/* Delete Confirmation Dialog - Admin Only */}
        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            title={m.colleague_dialog_deactivateTitle()}
            message={
              colleagueToDelete
                ? m.colleague_dialog_deactivateMessage({ name: colleagueToDelete.name })
                : ''
            }
            confirmText={m.colleague_dialog_deactivateButton()}
            onConfirm={confirmDelete}
            confirmButtonTestId="deactivate-btn"
          />
        </AdminOnly>

        {/* Restore Confirmation Dialog */}
        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isRestoreDialogOpen}
            onOpenChange={setIsRestoreDialogOpen}
            title={m.colleague_dialog_restoreTitle()}
            message={
              colleagueToRestore
                ? m.colleague_dialog_restoreMessage({ name: colleagueToRestore.name })
                : ''
            }
            onConfirm={handleRestore}
            confirmText={m.colleague_dialog_restoreButton()}
            confirmButtonTestId="restore-btn"
          />
        </AdminOnly>

        {/* Permanent Delete Confirmation Dialog */}
        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isPermanentDeleteDialogOpen}
            onOpenChange={setIsPermanentDeleteDialogOpen}
            title={m.colleague_dialog_deleteTitle()}
            message={
              colleagueToPermanentDelete
                ? m.colleague_dialog_deleteMessage({ name: colleagueToPermanentDelete.name })
                : ''
            }
            onConfirm={handlePermanentDelete}
            confirmText={m.colleague_dialog_deleteButton()}
            confirmButtonTestId="delete-permanently-btn"
          />
        </AdminOnly>
      </div>
    </ProtectedRoute>
  );
}
