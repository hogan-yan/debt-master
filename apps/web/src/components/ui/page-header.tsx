import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  className = '',
  'data-testid': testid,
}: PageHeaderProps) {
  return (
    <div className={`flex justify-between items-center ${className}`} data-testid={testid}>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
