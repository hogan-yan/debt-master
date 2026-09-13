import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateWithActionProps {
  title?: string;
  description?: string;
  actionText: string;
  onAction: () => void;
  icon?: ReactNode;
  className?: string;
  actionVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  headingLevel?: 'h2' | 'h3' | 'h4';
}

export function EmptyStateWithAction({
  title,
  description,
  actionText,
  onAction,
  icon,
  className = '',
  actionVariant = 'outline',
  headingLevel: Heading = 'h3',
}: EmptyStateWithActionProps) {
  return (
    <div className={`text-center py-8 ${className}`}>
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      {title && <Heading className="text-lg font-medium text-foreground mb-2">{title}</Heading>}
      {description && <p className="text-muted-foreground mb-4">{description}</p>}
      <Button onClick={onAction} className="mt-4" variant={actionVariant}>
        {actionText}
      </Button>
    </div>
  );
}
