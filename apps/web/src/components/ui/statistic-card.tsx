import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTAINER_CLASSES, TYPOGRAPHY_CLASSES } from '@/styles/class-constants';

interface StatisticCardProps {
  title: string;
  value: string | number | ReactNode;
  description?: string;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
  'data-testid'?: string;
}

export function StatisticCard({
  title,
  value,
  description,
  icon,
  valueClassName = '',
  className = '',
  'data-testid': dataTestId,
}: StatisticCardProps) {
  return (
    <Card className={className} data-testid={dataTestId}>
      <CardHeader className={CONTAINER_CLASSES.CARD_HEADER_PADDING}>
        <CardTitle className={TYPOGRAPHY_CLASSES.CARD_TITLE}>{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div
          className={`${TYPOGRAPHY_CLASSES.STAT_VALUE} ${valueClassName}`}
          data-testid={dataTestId ? `${dataTestId}-value` : undefined}
        >
          {value}
        </div>
        {description && <p className={TYPOGRAPHY_CLASSES.DESCRIPTION}>{description}</p>}
      </CardContent>
    </Card>
  );
}
