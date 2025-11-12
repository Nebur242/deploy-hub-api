import { User } from '@app/modules/users/entities/user.entity';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { SubscriptionSeederService } from './subscription-seeder.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from '../dto/upgrade-subscription.dto';
import {
  SubscriptionPlan,
  SubscriptionPlanType,
  SubscriptionPlanStatus,
} from '../entities/subscription-plan.entity';
import { UserSubscription, SubscriptionStatus } from '../entities/user-subscription.entity';

@Injectable()
export class UserSubscriptionService {
  constructor(
    @InjectRepository(UserSubscription)
    private userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
    private readonly subscriptionSeederService: SubscriptionSeederService,
  ) {}

  /**
   * Create a new subscription for a user
   */
  async createSubscription(
    user: User,
    createDto: CreateSubscriptionDto,
  ): Promise<UserSubscription> {
    // Check if plan exists
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: createDto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${createDto.planId} not found`);
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.userSubscriptionRepository.findOne({
      where: {
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();

    if (plan.type === SubscriptionPlanType.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription
    const subscription = this.userSubscriptionRepository.create({
      userId: user.id,
      user,
      planId: createDto.planId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      autoRenew: createDto.autoRenew ?? true,
      metadata: createDto.metadata,
    });

    return this.userSubscriptionRepository.save(subscription);
  }

  /**
   * Get user's current subscription
   */
  getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    return this.userSubscriptionRepository.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
    });
  }

  /**
   * Get user's subscription history
   */
  getUserSubscriptions(
    userId: string,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<UserSubscription>> {
    const queryBuilder = this.userSubscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.plan', 'plan')
      .where('subscription.userId = :userId', { userId })
      .orderBy('subscription.createdAt', 'DESC');

    return paginate<UserSubscription>(queryBuilder, paginationOptions);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string, subscriptionId: string): Promise<UserSubscription> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        id: subscriptionId,
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Active subscription not found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;

    return this.userSubscriptionRepository.save(subscription);
  }

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);
    return !!subscription && subscription.status === SubscriptionStatus.ACTIVE;
  }

  /**
   * Get subscription usage/limits for a user
   */
  async getSubscriptionLimits(userId: string) {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      return {
        hasActiveSubscription: false,
        maxProjects: 1, // Free tier
        maxDeployments: 3, // Free tier
        maxTeamMembers: 1, // Free tier
        features: [],
      };
    }

    return {
      hasActiveSubscription: true,
      maxProjects: subscription.plan.maxProjects,
      maxDeployments: subscription.plan.maxDeployments,
      maxTeamMembers: subscription.plan.maxTeamMembers,
      features: subscription.plan.features,
      planName: subscription.plan.name,
      planType: subscription.plan.type,
    };
  }

  /**
   * Check if user can perform a specific action based on their subscription limits
   */
  async canPerformAction(
    userId: string,
    action: 'create_project' | 'create_deployment',
  ): Promise<boolean> {
    const limits = await this.getSubscriptionLimits(userId);

    // For now, we'll just check if they have an active subscription
    // In a real implementation, you'd also check current usage vs limits
    if (!limits.hasActiveSubscription) {
      // Free tier users have limited access
      return action === 'create_project' ? limits.maxProjects > 0 : limits.maxDeployments > 0;
    }

    return true; // Premium users can perform actions
  }

  /**
   * Upgrade user's current subscription to a new plan
   */
  async upgradePlan(
    userId: string,
    newPlanId: string,
    upgradeDto?: UpgradeSubscriptionDto,
  ): Promise<UserSubscription> {
    // Get current active subscription
    const currentSubscription = await this.getCurrentSubscription(userId);
    if (!currentSubscription) {
      throw new NotFoundException('No active subscription found to upgrade');
    }

    // Get the new plan
    const newPlan = await this.subscriptionPlanRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException(`Subscription plan with ID ${newPlanId} not found`);
    }

    // Validate upgrade (ensure new plan is higher tier)
    const isValidUpgrade = this.validateUpgrade(currentSubscription.plan, newPlan);
    if (!isValidUpgrade) {
      throw new BadRequestException(
        'Invalid upgrade: New plan must be a higher tier than current plan',
      );
    }

    // Cancel current subscription
    currentSubscription.status = SubscriptionStatus.CANCELLED;
    currentSubscription.cancelledAt = new Date();
    currentSubscription.autoRenew = false;
    await this.userSubscriptionRepository.save(currentSubscription);

    // Calculate new subscription dates
    const startDate = new Date();
    const endDate = new Date();

    // Set end date based on plan type (unless it's free tier)
    if (newPlan.price > 0) {
      if (newPlan.type === SubscriptionPlanType.MONTHLY) {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
    }

    // Create new subscription
    const newSubscription = this.userSubscriptionRepository.create({
      userId,
      planId: newPlanId,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate: newPlan.price > 0 ? endDate : undefined, // Free tier doesn't expire
      autoRenew: newPlan.price > 0, // Only paid plans auto-renew
      metadata: {
        ...upgradeDto?.metadata,
        upgradedFrom: currentSubscription.planId,
        upgradeDate: new Date().toISOString(),
      },
    });

    return this.userSubscriptionRepository.save(newSubscription);
  }

  /**
   * Validate if the upgrade is valid (new plan is higher tier)
   */
  private validateUpgrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
    // Free tier can upgrade to any paid plan
    if (currentPlan.price === 0 && newPlan.price > 0) {
      return true;
    }

    // Can't downgrade to free tier
    if (newPlan.price === 0) {
      return false;
    }

    // For paid plans, compare by price and features
    if (newPlan.price > currentPlan.price) {
      return true;
    }

    // Same price but annual vs monthly (annual is considered upgrade)
    if (
      newPlan.price === currentPlan.price * 12 &&
      currentPlan.type === SubscriptionPlanType.MONTHLY &&
      newPlan.type === SubscriptionPlanType.ANNUAL
    ) {
      return true;
    }

    // Check feature count (more features = higher tier)
    if (newPlan.features.length > currentPlan.features.length) {
      return true;
    }

    return false;
  }

  /**
   * Get available upgrade options for a user
   */
  async getUpgradeOptions(userId: string): Promise<SubscriptionPlan[]> {
    const currentSubscription = await this.getCurrentSubscription(userId);

    if (!currentSubscription) {
      // If no subscription, return all paid plans
      return this.subscriptionPlanRepository.find({
        where: { status: SubscriptionPlanStatus.ACTIVE },
        order: { sortOrder: 'ASC' },
      });
    }

    // Get all active plans
    const allPlans = await this.subscriptionPlanRepository.find({
      where: { status: SubscriptionPlanStatus.ACTIVE },
      order: { sortOrder: 'ASC' },
    });

    // Filter to only show valid upgrades
    return allPlans.filter(
      plan =>
        plan.id !== currentSubscription.planId &&
        this.validateUpgrade(currentSubscription.plan, plan),
    );
  }

  /**
   * Automatically assign free tier subscription to a new user
   */
  async assignFreeTierToUser(user: User): Promise<UserSubscription | null> {
    // Check if user already has a subscription
    const existingSubscription = await this.getCurrentSubscription(user.id);
    if (existingSubscription) {
      return existingSubscription;
    }

    // Get the free tier plan
    const freeTierPlan = await this.subscriptionSeederService.getFreeTierPlan();
    if (!freeTierPlan) {
      throw new NotFoundException('Free tier plan not found. Please run seeder first.');
    }

    // Create free tier subscription
    const subscription = this.userSubscriptionRepository.create({
      userId: user.id,
      planId: freeTierPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: undefined, // Free tier doesn't expire
      autoRenew: false, // Free tier doesn't auto-renew
    });

    return this.userSubscriptionRepository.save(subscription);
  }

  /**
   * Admin: Get all subscriptions with filtering
   */
  getAllSubscriptions(
    paginationOptions: IPaginationOptions,
    filters?: {
      userId?: string;
      status?: SubscriptionStatus;
      planId?: string;
    },
  ): Promise<Pagination<UserSubscription>> {
    const queryBuilder = this.userSubscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.plan', 'plan')
      .leftJoinAndSelect('subscription.user', 'user');

    if (filters?.userId) {
      queryBuilder.andWhere('subscription.userId = :userId', { userId: filters.userId });
    }

    if (filters?.status) {
      queryBuilder.andWhere('subscription.status = :status', { status: filters.status });
    }

    if (filters?.planId) {
      queryBuilder.andWhere('subscription.planId = :planId', { planId: filters.planId });
    }

    queryBuilder.orderBy('subscription.createdAt', 'DESC');

    return paginate<UserSubscription>(queryBuilder, paginationOptions);
  }

  /**
   * Calculate upgrade pricing (for future payment integration)
   */
  async calculateUpgradePricing(userId: string, newPlanId: string): Promise<UpgradePricingInfo> {
    const currentSubscription = await this.getCurrentSubscription(userId);
    if (!currentSubscription) {
      throw new NotFoundException('No active subscription found');
    }

    const newPlan = await this.subscriptionPlanRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException(`Subscription plan with ID ${newPlanId} not found`);
    }

    const priceDifference = newPlan.price - currentSubscription.plan.price;
    const isUpgrade = this.validateUpgrade(currentSubscription.plan, newPlan);

    // Calculate prorated amount if upgrading mid-cycle
    let remainingDays: number | undefined;
    let proratedAmount: number | undefined;

    if (currentSubscription.endDate && newPlan.price > 0) {
      const now = new Date();
      const endDate = new Date(currentSubscription.endDate);
      remainingDays = Math.max(
        0,
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );

      if (remainingDays > 0) {
        const totalDays = currentSubscription.plan.type === SubscriptionPlanType.MONTHLY ? 30 : 365;
        const unusedRatio = remainingDays / totalDays;
        proratedAmount = priceDifference * unusedRatio;
      }
    }

    return {
      currentPlan: currentSubscription.plan,
      newPlan,
      priceDifference,
      isUpgrade,
      remainingDays,
      proratedAmount,
    };
  }

  /**
   * Check if user can downgrade to a specific plan
   */
  async canDowngrade(userId: string, targetPlanId: string): Promise<boolean> {
    const currentSubscription = await this.getCurrentSubscription(userId);
    if (!currentSubscription) {
      return false;
    }

    const targetPlan = await this.subscriptionPlanRepository.findOne({
      where: { id: targetPlanId },
    });

    if (!targetPlan) {
      return false;
    }

    // Allow downgrade to free tier or lower-priced plans
    return targetPlan.price <= currentSubscription.plan.price;
  }

  /**
   * Schedule a subscription upgrade/downgrade for the next billing cycle
   */
  async scheduleUpgrade(
    userId: string,
    newPlanId: string,
    upgradeDto?: UpgradeSubscriptionDto,
  ): Promise<UserSubscription> {
    const currentSubscription = await this.getCurrentSubscription(userId);
    if (!currentSubscription) {
      throw new NotFoundException('No active subscription found');
    }

    const newPlan = await this.subscriptionPlanRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException(`Subscription plan with ID ${newPlanId} not found`);
    }

    // Update the subscription with scheduled upgrade information
    currentSubscription.metadata = {
      ...currentSubscription.metadata,
      scheduledUpgrade: {
        newPlanId,
        scheduledDate: currentSubscription.endDate,
        metadata: upgradeDto?.metadata,
      },
    };

    return this.userSubscriptionRepository.save(currentSubscription);
  }

  /**
   * Process scheduled upgrades and renewals (can be called by a cron job)
   */
  async processScheduledUpgrades(): Promise<void> {
    const subscriptionsWithScheduledUpgrades = await this.userSubscriptionRepository
      .createQueryBuilder('subscription')
      .where("subscription.metadata->>'scheduledUpgrade' IS NOT NULL")
      .andWhere('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('subscription.endDate <= :now', { now: new Date() })
      .getMany();

    for (const subscription of subscriptionsWithScheduledUpgrades) {
      try {
        const scheduledUpgrade = subscription.metadata?.scheduledUpgrade as ScheduledUpgrade;
        if (scheduledUpgrade?.newPlanId) {
          await this.upgradePlan(subscription.userId, scheduledUpgrade.newPlanId, {
            metadata: scheduledUpgrade.metadata,
          });
        }
      } catch (error) {
        console.error(
          `Failed to process scheduled upgrade for subscription ${subscription.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Get subscription analytics for a user
   */
  async getSubscriptionAnalytics(userId: string): Promise<SubscriptionAnalytics> {
    const currentSubscription = await this.getCurrentSubscription(userId);
    const subscriptionHistory = await this.userSubscriptionRepository.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    const totalSpent = subscriptionHistory
      .filter(sub => sub.plan.price > 0)
      .reduce((sum, sub) => sum + sub.plan.price, 0);

    const upgradeHistory = subscriptionHistory
      .filter(sub => sub.metadata?.upgradedFrom)
      .map(sub => ({
        date: sub.createdAt,
        fromPlan: (sub.metadata?.upgradedFrom as string) || '',
        toPlan: sub.planId,
        price: sub.plan.price,
      }));

    return {
      currentSubscription,
      totalSubscriptions: subscriptionHistory.length,
      totalSpent,
      upgradeHistory,
      accountAge: subscriptionHistory[subscriptionHistory.length - 1]?.createdAt,
      isActiveSubscriber: !!currentSubscription,
    };
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  getByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
    return this.userSubscriptionRepository.findOne({
      where: { stripeSubscriptionId },
      relations: ['plan', 'user'],
    });
  }

  /**
   * Update subscription status and metadata
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
    updateData?: {
      cancelledAt?: Date;
      lastPaymentDate?: Date;
      stripeData?: Record<string, unknown>;
      [key: string]: unknown;
    },
  ): Promise<UserSubscription> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    // Update subscription properties
    subscription.status = status;

    if (updateData) {
      if (updateData.cancelledAt) {
        subscription.cancelledAt = updateData.cancelledAt;
      }

      // Update metadata with new stripe data
      subscription.metadata = {
        ...subscription.metadata,
        ...updateData.stripeData,
        lastUpdated: new Date().toISOString(),
      };

      // Apply any other update data (excluding special keys)
      const excludedKeys = ['stripeData', 'cancelledAt', 'lastPaymentDate'];
      Object.keys(updateData).forEach(key => {
        if (!excludedKeys.includes(key) && updateData[key] !== undefined) {
          // Type-safe property assignment would go here
          // For now, we'll just handle known properties
        }
      });
    }

    return this.userSubscriptionRepository.save(subscription);
  }
}

// Interfaces for better type safety
interface ScheduledUpgrade {
  newPlanId: string;
  scheduledDate: string;
  metadata?: Record<string, unknown>;
}

interface UpgradePricingInfo {
  currentPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  priceDifference: number;
  isUpgrade: boolean;
  remainingDays?: number;
  proratedAmount?: number;
}

interface SubscriptionAnalytics {
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
