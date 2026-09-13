/**
 * Team participation chart component
 * Shows team engagement and participation statistics
 */

import { ThumbsUp, TrendingUp, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { m } from '@/paraglide/messages';

interface ParticipationChartProps {
  lunchParticipationRate: number;
}

/**
 * Team participation chart component
 */
export function ParticipationChart({ lunchParticipationRate }: ParticipationChartProps) {
  const getEngagementIcon = () => {
    if (lunchParticipationRate > 80) {
      return <Trophy className="h-4 w-4" />;
    }
    if (lunchParticipationRate > 60) {
      return <ThumbsUp className="h-4 w-4" />;
    }
    return <TrendingUp className="h-4 w-4" />;
  };

  const getEngagementText = () => {
    if (lunchParticipationRate > 80) {
      return m.dashboard_engagementExcellent();
    }
    if (lunchParticipationRate > 60) {
      return m.dashboard_engagementGood();
    }
    return m.dashboard_engagementNeedsWork();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-foreground">
          <Users className="h-5 w-5" />
          <span>{m.dashboard_teamParticipation()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-foreground">
            {lunchParticipationRate.toFixed(0)}%
          </div>
          <p className="text-sm text-muted-foreground">{m.dashboard_overallParticipation()}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-foreground">{m.dashboard_engagementLevel()}</span>
            <span className="text-muted-foreground">{lunchParticipationRate.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary/70 h-3 rounded-full transition-[width]"
              style={{ width: `${lunchParticipationRate}%` }}
            />
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            {getEngagementIcon()}
            {getEngagementText()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
