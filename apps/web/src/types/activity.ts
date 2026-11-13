/**
 * Activity-related types for the debt-master application
 */

import { ActivityType, BaseEntity } from './common';

export interface Activity extends BaseEntity {
  type: ActivityType;
  description: string;
  amount: number;
  date: string;
  colleague?: string;
  colleagueId?: number;
}

export interface DashboardStats {
  totalOwed: number;
  totalPrepaid: number;
  netBalance: number;
  activeColleagues: number;
}
