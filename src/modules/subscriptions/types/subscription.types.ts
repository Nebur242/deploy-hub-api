import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { UserSubscription } from '../entities/user-subscription.entity';

export interface ScheduledUpgrade {
  newPlanId: string;
  scheduledDate: string;
  metadata?: Record<string, unknown>;
}

export interface UpgradePricingInfo {
  currentPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  priceDifference: number;
  isUpgrade: boolean;
  remainingDays?: number;
  proratedAmount?: number;
}

export interface SubscriptionAnalytics {
  currentSubscription: UserSubscription | null;
  totalSubscriptions: number;
  totalSpent: number;
  upgradeHistory: Array<{
    date: Date;
    fromPlan: string;
    toPlan: string;
    price: number;
  }>;
  accountAge: Date | undefined;
  isActiveSubscriber: boolean;
}
