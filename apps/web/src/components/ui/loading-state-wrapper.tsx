import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingStateWrapperProps {
  isLoading: boolean;
  children: ReactNode;
  loadingComponent?: ReactNode;
  skeletonType?: 'table' | 'cards' | 'custom';
  skeletonCount?: number;
  className?: string;
}

/**
 * Simple skeleton placeholder component
 */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

/**
 * Wrapper component for consistent loading state management across data tables and lists.
 * Provides standardized loading UI patterns and skeleton placeholders.
 */
export function LoadingStateWrapper({
  isLoading,
  children,
  loadingComponent,
  skeletonType = 'table',
  skeletonCount = 5,
  className = '',
}: LoadingStateWrapperProps) {
  if (!isLoading) {
    return <>{children}</>;
  }

  // Custom loading component takes precedence
  if (loadingComponent) {
    return <div className={className}>{loadingComponent}</div>;
  }

  // Default skeleton patterns
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading content...</span>
      {skeletonType === 'table' && (
        <div className="space-y-2">
          {/* Table header skeleton */}
          <div className="flex space-x-4 pb-2 border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Table rows skeleton */}
          {Array.from({ length: skeletonCount }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders
            <div key={i} className="flex space-x-4 py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {skeletonType === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {skeletonType === 'custom' && (
        <div className="space-y-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Simple loading spinner component for inline loading states
 */
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-spin rounded-full h-8 w-8 border-b-2 border-border"
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Loading overlay for absolute positioned loading states
 */
export function LoadingOverlay({
  isVisible,
  children,
}: {
  isVisible: boolean;
  children?: ReactNode;
}) {
  if (!isVisible) return null;

  return (
    <div
      className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-50"
      role="status"
      aria-live="polite"
    >
      {children || <LoadingSpinner />}
    </div>
  );
}
