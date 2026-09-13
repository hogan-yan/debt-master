import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  MapPin,
  Pencil,
  Receipt,
  StickyNote,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatisticCard } from '@/components/ui/statistic-card';
import { getCuisineLabel, getCuisineSelectOptions } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { deleteRestaurant, updateRestaurant } from '@/server/restaurants/restaurant-mutations';
import { getRestaurantById } from '@/server/restaurants/restaurant-queries';
import { COMMON, NAV, RESTAURANT, RESTAURANT_DETAIL } from '@/test/test-ids';
import { isAuthError } from '@/utils/auth-client';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { isAppError } from '@/utils/errors';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { ProtectedRoute } from '@/utils/route-protection';

// Cuisine pill on the detail header. unslop-ignore
const CUISINE_PILL_CLASS =
  'inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'; // unslop-ignore

// Simple Skeleton component
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

interface LoaderData {
  restaurant: NonNullable<Awaited<ReturnType<typeof getRestaurantById>>> | null;
}

export const Route = createFileRoute('/restaurants/$id')({
  component: RestaurantDetailPage,
  head: () => ({
    meta: [{ title: 'Restaurant Details — Debt Master' }],
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const restaurantId = Number.parseInt(params.id, 10);

    if (Number.isNaN(restaurantId) || restaurantId <= 0) {
      throw redirect({ to: '/restaurants/' });
    }

    try {
      const restaurant = await getRestaurantById({ data: { id: restaurantId } });

      if (!restaurant) {
        throw redirect({ to: '/restaurants/' });
      }

      return { restaurant };
    } catch (error) {
      if (isAuthError(error)) {
        return { restaurant: null };
      }
      if (
        isAppError(error) &&
        (error as Error & { code: string }).code === 'NOT_FOUND_RESTAURANT'
      ) {
        throw redirect({ to: '/restaurants/' });
      }
      if (error instanceof Error && error.message === 'Restaurant not found') {
        throw redirect({ to: '/restaurants/' });
      }
      throw redirect({ to: '/restaurants/' });
    }
  },
  errorComponent: ({ error }) => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive-text mx-auto" />
        <h2 className="text-xl font-semibold">{m.restaurant_detail_failedLoad()}</h2>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : m.restaurant_detail_tryAgain()}
        </p>
        <Button asChild>
          <Link to="/restaurants/">{m.restaurant_detail_back()}</Link>
        </Button>
      </div>
    </div>
  ),
  pendingComponent: () => <RestaurantDetailSkeleton />,
});

function RestaurantDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RestaurantDetailPage() {
  const { restaurant: initialRestaurant } = Route.useLoaderData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(initialRestaurant?.name ?? '');
  const [editCuisine, setEditCuisine] = useState(initialRestaurant?.cuisine || '');
  const [editNotes, setEditNotes] = useState(initialRestaurant?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [restaurant, setRestaurant] = useState(initialRestaurant);

  if (!restaurant) {
    return <ProtectedRoute hasSsrData={false}>{null}</ProtectedRoute>;
  }

  const handleSaveChanges = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    setIsSaving(true);
    try {
      await updateRestaurant({
        data: {
          id: restaurant.id,
          name: trimmedName !== restaurant.name ? trimmedName : undefined,
          cuisine: editCuisine || undefined,
          notes: editNotes.trim() || undefined,
        },
      });
      setRestaurant({
        ...restaurant,
        name: trimmedName,
        cuisine: editCuisine || null,
        notes: editNotes.trim() || null,
      });
      toast.success(m.restaurant_detail_updated());
      setIsEditing(false);
    } catch (_error) {
      toast.error(m.restaurant_detail_updateFailed());
      setEditName(restaurant.name);
      setEditCuisine(restaurant.cuisine || '');
      setEditNotes(restaurant.notes || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(restaurant.name);
    setEditCuisine(restaurant.cuisine || '');
    setEditNotes(restaurant.notes || '');
  };

  const handleDelete = async () => {
    if (!confirm(m.restaurant_detail_deleteMessage({ name: restaurant.name }))) {
      return;
    }

    try {
      await deleteRestaurant({ data: { id: restaurant.id } });
      toast.success(m.restaurant_detail_deleted({ name: restaurant.name }));
      await router.invalidate();
      navigate({ to: '/restaurants/' });
    } catch (_error) {
      toast.error(m.restaurant_detail_deleteFailed());
    }
  };

  const expenses = restaurant.expenses || [];
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = expenses.slice(0, 10);

  return (
    <ProtectedRoute hasSsrData={!!restaurant}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link
            to="/restaurants/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label={m.restaurant_detail_back()}
            data-testid={NAV.BACK_TO_RESTAURANTS_LINK}
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            {m.restaurant_detail_back()}
          </Link>

          {isAdmin && (
            <AdminOnly>
              {isEditing ? (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    data-testid={COMMON.CANCEL_BTN}
                  >
                    {m.common_cancel()}
                  </Button>
                  <Button
                    onClick={handleSaveChanges}
                    disabled={!editName.trim() || isSaving}
                    data-testid={RESTAURANT.SAVE_CHANGES_BTN}
                  >
                    {isSaving ? m.restaurant_detail_saving() : m.restaurant_detail_saveChanges()}
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    className="gap-2"
                    data-testid={RESTAURANT.EDIT_BTN}
                  >
                    <Pencil className="h-4 w-4" />
                    {m.expense_action_edit()}
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    className="gap-2"
                    data-testid={RESTAURANT.DELETE_BTN}
                  >
                    <Trash2 className="h-4 w-4" />
                    {m.common_delete()}
                  </Button>
                </div>
              )}
            </AdminOnly>
          )}
        </div>

        {/* Restaurant Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3" data-testid={RESTAURANT.DETAILS_HEADING}>
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
              </div>
              {m.restaurant_detail_details()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label
                  htmlFor="restaurant-name"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  {m.restaurant_detail_label_name()}
                </label>
                {isEditing && isAdmin ? (
                  <input
                    id="restaurant-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary bg-background"
                    disabled={isSaving}
                    aria-label={m.restaurant_detail_label_name()}
                    data-testid={RESTAURANT_DETAIL.DETAIL_RESTAURANT_NAME_INPUT}
                  />
                ) : (
                  <p
                    className="text-xl font-semibold text-foreground"
                    data-testid={RESTAURANT.RESTAURANT_NAME_TEXT}
                  >
                    {restaurant.name}
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {m.restaurant_detail_label_address()}
                </span>
                <p className="text-foreground" data-testid={RESTAURANT.RESTAURANT_ADDRESS_TEXT}>
                  {restaurant.address || m.restaurant_detail_noAddress()}
                </p>
              </div>

              {/* Cuisine */}
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <UtensilsCrossed className="h-4 w-4" />
                  {m.restaurant_detail_label_cuisine()}
                </span>
                {isEditing && isAdmin ? (
                  <Select value={editCuisine} onValueChange={setEditCuisine}>
                    <SelectTrigger
                      className="w-full"
                      disabled={isSaving}
                      aria-label={m.restaurant_detail_label_cuisine()}
                      data-testid={RESTAURANT_DETAIL.DETAIL_CUISINE_INPUT}
                    >
                      <SelectValue placeholder={m.restaurant_detail_placeholder_cuisine()} />
                    </SelectTrigger>
                    <SelectContent>
                      {getCuisineSelectOptions().map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : restaurant.cuisine ? (
                  <span className={CUISINE_PILL_CLASS} data-testid={RESTAURANT.CUISINE_BADGE}>
                    {getCuisineLabel(restaurant.cuisine)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {m.restaurant_detail_notSpecified()}
                  </span>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                  {m.restaurant_detail_label_notes()}
                </span>
                {isEditing && isAdmin ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={m.restaurant_detail_placeholder_notes()}
                    rows={3}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary bg-background resize-none"
                    disabled={isSaving}
                    aria-label={m.restaurant_detail_label_notes()}
                    data-testid={RESTAURANT_DETAIL.DETAIL_NOTES_INPUT}
                  />
                ) : restaurant.notes ? (
                  <p
                    className="text-foreground whitespace-pre-wrap"
                    data-testid={RESTAURANT.RESTAURANT_NOTES_TEXT}
                  >
                    {restaurant.notes}
                  </p>
                ) : (
                  <span className="text-muted-foreground">{m.restaurant_detail_noNotes()}</span>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{m.restaurant_detail_stat_added()}</p>
                  <p className="font-medium">{formatDate(restaurant.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {m.restaurant_detail_stat_totalExpenses()}
                  </p>
                  <p className="font-medium">
                    {totalExpenses}{' '}
                    {totalExpenses !== 1
                      ? m.restaurant_detail_expenses()
                      : m.restaurant_detail_expense()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{m.restaurant_detail_stat_totalSpent()}</p>
                  <p className="font-medium">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StatisticCard
            title={m.restaurant_detail_stat_totalExpenses()}
            value={String(totalExpenses)}
            data-testid={RESTAURANT_DETAIL.TOTAL_EXPENSES_KPI}
            description={m.restaurant_detail_atThisRestaurant()}
            icon={<Receipt className="h-4 w-4" />}
          />
          <StatisticCard
            title={m.restaurant_summary_totalAmount()}
            value={formatCurrency(totalAmount)}
            data-testid={RESTAURANT_DETAIL.TOTAL_AMOUNT_SPENT_KPI}
            description={m.restaurant_detail_acrossExpenses({ count: totalExpenses })}
            icon={<UtensilsCrossed className="h-4 w-4" />}
          />
        </div>

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2"
              data-testid={RESTAURANT_DETAIL.RECENT_EXPENSES_HEADING}
            >
              {m.restaurant_detail_recentExpenses()}
              <span className="text-sm font-normal text-muted-foreground">
                ({recentExpenses.length} of {totalExpenses})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentExpenses.length > 0 ? (
              <div className="space-y-3">
                {recentExpenses.map((expense) => {
                  const participantNames =
                    expense.participants
                      ?.map((p) => p.colleague?.name)
                      .filter(Boolean)
                      .join(', ') || m.common_unknown();

                  return (
                    <Link
                      key={expense.id}
                      to="/expense/$id/"
                      params={{ id: String(expense.id) }}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
                          <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{formatDate(expense.date)}</p>
                          <p className="text-sm text-muted-foreground">{participantNames}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatCurrency(expense.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {expense.participants?.length || 0}{' '}
                          {expense.participants?.length !== 1
                            ? m.restaurant_detail_participants()
                            : m.restaurant_detail_participant()}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Receipt className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">
                    {m.restaurant_detail_noExpenses()}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {m.restaurant_detail_noExpensesDesc()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
