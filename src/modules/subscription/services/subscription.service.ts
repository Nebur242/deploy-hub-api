import { ProjectService } from '@app/modules/projects/services/project.service';
import { UsersService } from '@app/modules/users/users.service';
import { BillingInterval, SubscriptionPlan, SubscriptionStatus } from '@app/shared/enums';
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type StripeNS from 'stripe';
import { Repository } from 'typeorm';

import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from '../dto/create-checkout-session.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { Subscription } from '../entities/subscription.entity';

// Type alias for clarity
type StripeSubscription = StripeNS.Subscription;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly apiBaseUrl: string;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly projectService: ProjectService,
  ) {
    this.apiBaseUrl = this.configService.get<string>('API_BASE_URL') || '';
  }

  /**
   * Get or create a subscription for a user
   * New users automatically get a FREE plan
   */
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    let subscription = await this.subscriptionRepository.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!subscription) {
      // Get user info
      const user = await this.usersService.findOne(userId);

      // Create Stripe customer
      const stripeCustomer = await this.stripeService.createOrGetCustomer(
        userId,
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined,
      );

      // Create free subscription
      const planConfig = this.stripeService.getPlanConfig(SubscriptionPlan.FREE);

      subscription = this.subscriptionRepository.create({
        user_id: userId,
        stripe_customer_id: stripeCustomer.id,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        max_projects: planConfig?.maxProjects ?? 3,
        max_deployments_per_month: planConfig?.maxDeploymentsPerMonth ?? 100,
        custom_domain_enabled: planConfig?.customDomainEnabled ?? false,
        priority_support: planConfig?.prioritySupport ?? false,
        analytics_enabled: planConfig?.analyticsEnabled ?? false,
        amount: 0,
      });

      await this.subscriptionRepository.save(subscription);
      this.logger.log(`Created free subscription for user ${userId}`);
    }

    return subscription;
  }

  /**
   * Get user's current subscription
   */
  async getSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!subscription) {
      return this.getOrCreateSubscription(userId);
    }

    return subscription;
  }

  /**
   * Create a checkout session to upgrade subscription
   */
  async createCheckoutSession(
    userId: string,
    dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string }> {
    const subscription = await this.getOrCreateSubscription(userId);

    if (dto.plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot create checkout for free plan');
    }

    if (subscription.plan === dto.plan && subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('You are already subscribed to this plan');
    }

    if (!subscription.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer found for this user');
    }

    const successUrl = dto.success_url || `${this.apiBaseUrl}/dashboard/billing?success=true`;
    const cancelUrl = dto.cancel_url || `${this.apiBaseUrl}/dashboard/billing?canceled=true`;

    const session = await this.stripeService.createCheckoutSession(
      subscription.stripe_customer_id,
      dto.plan,
      dto.billing_interval,
      successUrl,
      cancelUrl,
    );

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return { url: session.url };
  }

  /**
   * Create a billing portal session for managing subscription
   */
  async createPortalSession(userId: string, returnUrl?: string): Promise<{ url: string }> {
    const subscription = await this.getSubscription(userId);

    if (!subscription.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer found for this user');
    }

    const url = returnUrl || `${this.apiBaseUrl}/dashboard/billing`;

    const session = await this.stripeService.createPortalSession(
      subscription.stripe_customer_id,
      url,
    );

    return { url: session.url };
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);

    if (!subscription.stripe_subscription_id) {
      throw new BadRequestException('No active subscription to update');
    }

    // Handle cancellation
    if (dto.cancel_at_period_end !== undefined) {
      if (dto.cancel_at_period_end) {
        await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, false);
      } else {
        await this.stripeService.reactivateSubscription(subscription.stripe_subscription_id);
      }

      subscription.cancel_at_period_end = dto.cancel_at_period_end;
      if (!dto.cancel_at_period_end) {
        subscription.cancel_at = undefined;
        subscription.canceled_at = undefined;
      }
    }

    // Handle plan change
    if (dto.plan && dto.billing_interval) {
      if (dto.plan === SubscriptionPlan.FREE) {
        // Downgrade to free - cancel subscription
        await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, false);
        subscription.cancel_at_period_end = true;
      } else {
        await this.stripeService.updateSubscription(
          subscription.stripe_subscription_id,
          dto.plan,
          dto.billing_interval,
        );
      }
    }

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancel subscription immediately
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);

    if (!subscription.stripe_subscription_id) {
      throw new BadRequestException('No active subscription to cancel');
    }

    await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, false);

    subscription.cancel_at_period_end = true;
    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Get available plans
   */
  getAvailablePlans() {
    return this.stripeService.getAllPlans();
  }

  /**
   * Handle Stripe webhook event: checkout.session.completed
   */
  async handleCheckoutCompleted(session: Record<string, any>): Promise<void> {
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // Find subscription by stripe customer ID
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripe_customer_id: customerId },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for customer ${customerId}`);
      return;
    }

    // Get Stripe subscription details
    const stripeSubData: StripeSubscription =
      await this.stripeService.getSubscription(subscriptionId);

    const plan = (stripeSubData.metadata.plan as SubscriptionPlan) || SubscriptionPlan.STARTER;
    const billingInterval =
      (stripeSubData.metadata.billing_interval as BillingInterval) || BillingInterval.MONTHLY;
    const planConfig = this.stripeService.getPlanConfig(plan);

    // Update subscription
    subscription.stripe_subscription_id = subscriptionId;
    subscription.stripe_price_id = stripeSubData.items.data[0]?.price?.id;
    subscription.plan = plan;
    subscription.status = this.stripeService.mapStripeStatus(stripeSubData.status);
    subscription.billing_interval = billingInterval;
    subscription.amount = planConfig?.monthlyPrice || 0;

    // Get period dates from the first subscription item
    const firstItem = stripeSubData.items.data[0];
    if (firstItem) {
      subscription.current_period_start = new Date(firstItem.current_period_start * 1000);
      subscription.current_period_end = new Date(firstItem.current_period_end * 1000);
    }

    subscription.max_projects = planConfig?.maxProjects || 3;
    subscription.max_deployments_per_month = planConfig?.maxDeploymentsPerMonth || 100;
    subscription.custom_domain_enabled = planConfig?.customDomainEnabled || false;
    subscription.priority_support = planConfig?.prioritySupport || false;
    subscription.analytics_enabled = planConfig?.analyticsEnabled || false;

    if (stripeSubData.trial_start) {
      subscription.trial_start = new Date(stripeSubData.trial_start * 1000);
    }
    if (stripeSubData.trial_end) {
      subscription.trial_end = new Date(stripeSubData.trial_end * 1000);
    }

    await this.subscriptionRepository.save(subscription);
    this.logger.log(`Updated subscription for customer ${customerId} to ${plan}`);
  }

  /**
   * Handle Stripe webhook event: customer.subscription.updated
   */
  async handleSubscriptionUpdated(stripeSubData: StripeSubscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripe_subscription_id: stripeSubData.id },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for Stripe subscription ${stripeSubData.id}`);
      return;
    }

    subscription.status = this.stripeService.mapStripeStatus(stripeSubData.status);

    // Get period dates from the first subscription item
    const firstItem = stripeSubData.items.data[0];
    if (firstItem) {
      subscription.current_period_start = new Date(firstItem.current_period_start * 1000);
      subscription.current_period_end = new Date(firstItem.current_period_end * 1000);
    }
    subscription.cancel_at_period_end = stripeSubData.cancel_at_period_end;

    if (stripeSubData.cancel_at) {
      subscription.cancel_at = new Date(stripeSubData.cancel_at * 1000);
    }
    if (stripeSubData.canceled_at) {
      subscription.canceled_at = new Date(stripeSubData.canceled_at * 1000);
    }

    await this.subscriptionRepository.save(subscription);
    this.logger.log(`Subscription ${stripeSubData.id} updated to status ${subscription.status}`);
  }

  /**
   * Handle Stripe webhook event: customer.subscription.deleted
   */
  async handleSubscriptionDeleted(stripeSubData: StripeSubscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripe_subscription_id: stripeSubData.id },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for Stripe subscription ${stripeSubData.id}`);
      return;
    }

    // Downgrade to free plan
    const freePlanConfig = this.stripeService.getPlanConfig(SubscriptionPlan.FREE);

    subscription.stripe_subscription_id = undefined;
    subscription.stripe_price_id = undefined;
    subscription.plan = SubscriptionPlan.FREE;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.billing_interval = undefined;
    subscription.amount = 0;
    subscription.current_period_start = undefined;
    subscription.current_period_end = undefined;
    subscription.cancel_at = undefined;
    subscription.cancel_at_period_end = false;
    subscription.canceled_at = new Date();
    subscription.max_projects = freePlanConfig?.maxProjects ?? 3;
    subscription.max_deployments_per_month = freePlanConfig?.maxDeploymentsPerMonth ?? 100;
    subscription.custom_domain_enabled = freePlanConfig?.customDomainEnabled ?? false;
    subscription.priority_support = freePlanConfig?.prioritySupport ?? false;
    subscription.analytics_enabled = freePlanConfig?.analyticsEnabled ?? false;

    await this.subscriptionRepository.save(subscription);
    this.logger.log(`Subscription ${stripeSubData.id} deleted, downgraded to free plan`);
  }

  /**
   * Handle Stripe webhook event: invoice.payment_failed
   */
  async handlePaymentFailed(invoice: Record<string, any>): Promise<void> {
    const customerId = invoice.customer as string;

    const subscription = await this.subscriptionRepository.findOne({
      where: { stripe_customer_id: customerId },
    });

    if (!subscription) {
      return;
    }

    subscription.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionRepository.save(subscription);

    this.logger.warn(`Payment failed for customer ${customerId}`);
    // TODO: Send notification email to user
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription.status === SubscriptionStatus.ACTIVE;
  }

  /**
   * Check if user can create more projects
   */
  async canCreateProject(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);

    if (subscription.max_projects === -1) {
      return true; // Unlimited
    }

    const currentProjectCount = await this.projectService.countByOwner(userId);
    return currentProjectCount < subscription.max_projects;
  }

  /**
   * Validate and throw error if user cannot create project
   */
  async validateProjectCreation(userId: string): Promise<void> {
    const canCreate = await this.canCreateProject(userId);
    if (!canCreate) {
      const subscription = await this.getSubscription(userId);
      throw new ForbiddenException(
        `You have reached your project limit (${subscription.max_projects}). Please upgrade your subscription to create more projects.`,
      );
    }
  }

  /**
   * Check if monthly deployment count needs to be reset
   */
  private shouldResetDeploymentCount(subscription: Subscription): boolean {
    if (!subscription.deployment_count_reset_at) {
      return true;
    }

    const now = new Date();
    const resetAt = new Date(subscription.deployment_count_reset_at);

    // Reset if we're in a new month
    return now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();
  }

  /**
   * Reset monthly deployment count if needed
   */
  private async resetDeploymentCountIfNeeded(subscription: Subscription): Promise<Subscription> {
    if (this.shouldResetDeploymentCount(subscription)) {
      subscription.deployments_this_month = 0;
      subscription.deployment_count_reset_at = new Date();
      await this.subscriptionRepository.save(subscription);
      this.logger.log(`Reset deployment count for user ${subscription.user_id}`);
    }
    return subscription;
  }

  /**
   * Check if user can make more deployments this month
   */
  async canDeploy(userId: string): Promise<boolean> {
    let subscription = await this.getSubscription(userId);
    subscription = await this.resetDeploymentCountIfNeeded(subscription);

    if (subscription.max_deployments_per_month === -1) {
      return true; // Unlimited
    }

    return subscription.deployments_this_month < subscription.max_deployments_per_month;
  }

  /**
   * Validate and throw error if user cannot deploy
   */
  async validateDeployment(userId: string): Promise<void> {
    const canDeploy = await this.canDeploy(userId);
    if (!canDeploy) {
      const subscription = await this.getSubscription(userId);
      throw new ForbiddenException(
        `You have reached your monthly deployment limit (${subscription.max_deployments_per_month}). Please upgrade your subscription for more deployments.`,
      );
    }
  }

  /**
   * Increment the monthly deployment count
   */
  async incrementDeploymentCount(userId: string): Promise<void> {
    let subscription = await this.getSubscription(userId);
    subscription = await this.resetDeploymentCountIfNeeded(subscription);

    subscription.deployments_this_month += 1;
    await this.subscriptionRepository.save(subscription);

    this.logger.log(
      `User ${userId} deployment count: ${subscription.deployments_this_month}/${subscription.max_deployments_per_month}`,
    );
  }

  /**
   * Get remaining deployments for the month
   */
  async getRemainingDeployments(userId: string): Promise<number> {
    let subscription = await this.getSubscription(userId);
    subscription = await this.resetDeploymentCountIfNeeded(subscription);

    if (subscription.max_deployments_per_month === -1) {
      return -1; // Unlimited
    }

    return Math.max(
      0,
      subscription.max_deployments_per_month - subscription.deployments_this_month,
    );
  }

  /**
   * Get remaining projects user can create
   */
  async getRemainingProjects(userId: string): Promise<number> {
    const subscription = await this.getSubscription(userId);

    if (subscription.max_projects === -1) {
      return -1; // Unlimited
    }

    const currentProjectCount = await this.projectService.countByOwner(userId);
    return Math.max(0, subscription.max_projects - currentProjectCount);
  }
}
