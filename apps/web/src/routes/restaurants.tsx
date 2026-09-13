/**
 * Restaurants route - Manage restaurant records and view analytics
 */

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { RestaurantForm } from '@/components/forms/restaurant-form';
import { RestaurantMobileCard } from '@/components/lists/restaurant-mobile-card';
import { Button } from '@/components/ui/button';
import { CRUDModalContainer } from '@/components/ui/crud-modal-container';
import { DataTableWithActions } from '@/components/ui/data-table-with-actions';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { EmptyStateWithAction } from '@/components/ui/empty-state-with-action';
import { PageHeader } from '@/components/ui/page-header';
import { SummaryCardsGrid } from '@/components/ui/summary-cards-grid';
import { createRestaurantColumns } from '@/config/table-columns';
import { useFormSubmission } from '@/hooks';
import { isCuisine } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import {
  createRestaurant,
  deleteRestaurant,
  updateRestaurant,
} from '@/server/restaurants/restaurant-mutations';
import { getRestaurantsPaginated } from '@/server/restaurants/restaurant-queries';
import { getRestaurantStats } from '@/server/restaurants/restaurant-stats';
import { RESTAURANT } from '@/test/test-ids';
import { Restaurant, RestaurantForm as RestaurantFormData } from '@/types';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { formatCurrency } from '@/utils/formatters';
import { ProtectedRoute } from '@/utils/route-protection';

export const Route = createFileRoute('/restaurants')({
  component: RestaurantsPage,
  head: () => ({
    meta: [{ title: 'Restaurants — Debt Master' }],
  }),
  loader: async () => {
    // Lazy import server functions to avoid TDZ issues during build
    const { getRestaurantsPaginated } = await import('@/server/restaurants/restaurant-queries');
    const { getRestaurantStats } = await import('@/server/restaurants/restaurant-stats');

    // Load initial page with default pagination
    const [paginatedRestaurants, stats] = await Promise.all([
      getRestaurantsPaginated({
        data: {
          page: 1,
          pageSize: 10,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      }),
      getRestaurantStats(),
    ]);
    return { paginatedRestaurants, stats };
  },
});

function RestaurantsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { paginatedRestaurants: initialData, stats: initialStats } = Route.useLoaderData();
  const hasSsrData = initialData.data.length > 0 || initialStats.totalRestaurants > 0;
  const queryClient = useQueryClient();

  const [listParams, setListParams] = useState<{
    page: number;
    pageSize: number;
    sortBy: 'name' | 'address' | 'createdAt';
    sortOrder: 'asc' | 'desc';
    search: string;
  }>({
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortOrder: 'asc',
    search: '',
  });

  // Params are the query key; mutations invalidate, refetches keep the view.
  const listQuery = useQuery({
    queryKey: ['restaurants', 'list', { ...listParams }],
    queryFn: () => getRestaurantsPaginated({ data: { ...listParams } }),
    placeholderData: keepPreviousData,
    initialData: initialData,
  });

  const statsQuery = useQuery({
    queryKey: ['restaurants', 'stats'],
    queryFn: () => getRestaurantStats(),
    initialData: initialStats,
  });

  const paginatedData = listQuery.data ?? initialData;
  const stats = statsQuery.data ?? initialStats;
  const isLoading = listQuery.isFetching;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);

  const refreshRestaurants = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['restaurants'] });
  }, [queryClient]);

  const { handleSubmit } = useFormSubmission({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      refreshRestaurants();
    },
    successTitle: m.common_success(),
    errorTitle: m.common_error(),
  });

  const handlePaginationChange = useCallback((page: number, pageSize: number) => {
    setListParams((prev) => ({ ...prev, page, pageSize }));
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setListParams((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    const effectiveSortBy = (['name', 'address', 'createdAt'] as const).includes(
      sortBy as 'name' | 'address' | 'createdAt'
    )
      ? (sortBy as 'name' | 'address' | 'createdAt')
      : 'name';
    setListParams((prev) => ({ ...prev, sortBy: effectiveSortBy, sortOrder }));
  }, []);

  const handleAddRestaurant = async (formData: RestaurantFormData) => {
    await handleSubmit(
      async () => {
        await createRestaurant({ data: { ...formData } });
        return { success: true };
      },
      m.restaurant_toast_added({ name: formData.name })
    );
  };

  const handleEditRestaurant = async (formData: RestaurantFormData) => {
    if (!selectedRestaurant) return;

    await handleSubmit(
      async () => {
        await updateRestaurant({
          data: {
            id: selectedRestaurant.id,
            name: formData.name,
            address: formData.address,
            cuisine: formData.cuisine,
            notes: formData.notes,
          },
        });
        return { success: true };
      },
      m.restaurant_toast_updated({ name: formData.name })
    );
  };

  const handleViewRestaurant = (restaurant: Restaurant) => {
    navigate({ to: '/restaurants/$id/', params: { id: String(restaurant.id) } });
  };

  const handleEditClick = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (restaurant: Restaurant) => {
    setRestaurantToDelete(restaurant);
    setIsDeleteDialogOpen(true);
  };

  const renderRestaurantMobileCard = (restaurant: Restaurant, _index: number) => (
    <RestaurantMobileCard
      restaurant={restaurant}
      isAdmin={isAdmin}
      onAction={(action, r) => {
        if (action === 'view') handleViewRestaurant(r);
        else if (action === 'edit') handleEditClick(r);
        else if (action === 'delete') handleDeleteClick(r);
      }}
    />
  );

  const confirmDelete = async () => {
    if (!restaurantToDelete) return;

    await handleSubmit(
      async () => {
        await deleteRestaurant({ data: { id: restaurantToDelete.id } });
        return { success: true };
      },
      m.restaurant_toast_deleted({ name: restaurantToDelete.name })
    );

    setIsDeleteDialogOpen(false);
    setRestaurantToDelete(null);
  };

  // If a child route (e.g. /restaurants/$id) is active, render only the outlet.
  // This check MUST come after all hooks to satisfy the rules of hooks.
  if (/^\/restaurants\/\d+\/?$/.test(pathname)) {
    return <Outlet />;
  }

  return (
    <ProtectedRoute hasSsrData={hasSsrData}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={m.restaurant_pageTitle()}
          subtitle={m.restaurant_pageSubtitle()}
          data-testid={RESTAURANT.MANAGEMENT_HEADING}
          action={
            <AdminOnly>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                data-testid={RESTAURANT.ADD_RESTAURANT_BTN}
              >
                {m.restaurant_addRestaurant()}
              </Button>
            </AdminOnly>
          }
        />

        {/* Summary Cards */}
        <SummaryCardsGrid
          cards={[
            {
              title: m.restaurant_summary_total(),
              value: stats.totalRestaurants,
            },
            {
              title: m.restaurant_summary_totalExpenses(),
              value: stats.totalExpenses,
            },
            {
              title: m.restaurant_summary_totalAmount(),
              value: formatCurrency(stats.totalAmount),
            },
          ]}
        />

        {/* Restaurants Table */}
        <DataTableWithActions
          title={isAdmin ? m.restaurant_pageTitle() : m.restaurant_table_all()}
          columns={createRestaurantColumns({
            onView: handleViewRestaurant,
            onEdit: handleEditClick,
            onDelete: handleDeleteClick,
            isAdmin,
          })}
          data={paginatedData.data}
          pagination={paginatedData.pagination}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          searchPlaceholder={m.restaurant_search_placeholder()}
          searchUiVariant="expense"
          isLoading={isLoading}
          mobileCardView={true}
          renderMobileCard={renderRestaurantMobileCard}
          searchInputTestId="search-restaurants-input"
          searchBtnTestId="search-btn"
          tableTestId="restaurant-table"
          rowTestId="restaurant-table-row"
          emptyStateComponent={
            stats.totalRestaurants === 0 ? (
              <AdminOnly>
                <EmptyStateWithAction
                  actionText={m.restaurant_empty_addFirst()}
                  onAction={() => setIsAddModalOpen(true)}
                />
              </AdminOnly>
            ) : null
          }
        />

        {/* Add Restaurant Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isAddModalOpen}
            onOpenChange={setIsAddModalOpen}
            title={m.restaurant_modal_addTitle()}
            maxWidth="lg"
          >
            <RestaurantForm
              onClose={() => setIsAddModalOpen(false)}
              onSubmit={handleAddRestaurant}
            />
          </CRUDModalContainer>
        </AdminOnly>

        {/* Edit Restaurant Modal - Admin Only */}
        <AdminOnly>
          <CRUDModalContainer
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            title={m.restaurant_modal_editTitle()}
            maxWidth="lg"
          >
            {selectedRestaurant && (
              <RestaurantForm
                initialData={{
                  name: selectedRestaurant.name,
                  address: selectedRestaurant.address || '',
                  cuisine:
                    selectedRestaurant.cuisine && isCuisine(selectedRestaurant.cuisine)
                      ? selectedRestaurant.cuisine
                      : undefined,
                  notes: selectedRestaurant.notes || '',
                }}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditRestaurant}
              />
            )}
          </CRUDModalContainer>
        </AdminOnly>

        {/* Delete Confirmation Dialog - Admin Only */}
        <AdminOnly>
          <DeleteConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            message={
              restaurantToDelete ? (
                <p>
                  Are you sure you want to delete restaurant &quot;{restaurantToDelete.name}&quot;?
                  This action cannot be undone and will only work if the restaurant has no
                  associated expenses.
                </p>
              ) : (
                ''
              )
            }
            onConfirm={confirmDelete}
          />
        </AdminOnly>
      </div>
    </ProtectedRoute>
  );
}
