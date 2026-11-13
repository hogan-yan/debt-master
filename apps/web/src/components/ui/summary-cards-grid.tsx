import { ReactNode } from 'react';
import { StatisticCard } from '@/components/ui/statistic-card';
import { LAYOUT_CLASSES } from '@/styles/class-constants';

export interface SummaryCardData {
  title: string;
  value: string | number | ReactNode;
  description?: string;
  icon?: ReactNode;
  valueClassName?: string;
}

interface SummaryCardsGridProps {
  cards: SummaryCardData[];
  className?: string;
}

export function SummaryCardsGrid({ cards, className = '' }: SummaryCardsGridProps) {
  return (
    <div className={`${LAYOUT_CLASSES.SUMMARY_GRID} ${className}`}>
      {cards.map((card) => (
        <StatisticCard
          key={card.title}
          title={card.title}
          value={card.value}
          {...(card.description ? { description: card.description } : {})}
          icon={card.icon}
          {...(card.valueClassName ? { valueClassName: card.valueClassName } : {})}
        />
      ))}
    </div>
  );
}
