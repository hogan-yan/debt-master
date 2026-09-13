import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', // unslop-ignore: badge pill is the deliberate status treatment
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-secondary/80',
        // Dark-mode status glows: deliberate emphasis, not decoration.
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 dark:bg-destructive/90 dark:shadow-[0_0_8px_-2px_hsl(var(--destructive)/0.3)]', // unslop-ignore
        success:
          'border-transparent bg-success text-success-foreground hover:bg-success/80 dark:bg-success/85 dark:shadow-[0_0_8px_-2px_hsl(var(--success)/0.25)]', // unslop-ignore
        warning:
          'border-transparent bg-warning text-warning-foreground hover:bg-warning/80 dark:bg-warning/85 dark:shadow-[0_0_8px_-2px_hsl(var(--warning)/0.25)]', // unslop-ignore
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
