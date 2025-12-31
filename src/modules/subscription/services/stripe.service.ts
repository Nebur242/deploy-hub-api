import { BillingInterval, SubscriptionPlan, SubscriptionStatus } from '@app/shared/enums';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface PlanConfig {
  plan: SubscriptionPlan;
  name: string;
  description: string;
  maxProjects: number;
  maxDeploymentsPerMonth: number;
  customDomainEnabled: boolean;
  prioritySupport: boolean;
  analyticsEnabled: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly webhookSecret: string;

  // Plan configuration
  public readonly plans: Map<SubscriptionPlan, PlanConfig> = new Map([
    [
      SubscriptionPlan.FREE,
      {
        plan: SubscriptionPlan.FREE,
        name: 'Free',
        description: 'Perfect for trying out the platform',
        maxProjects: 1,
        maxDeploymentsPerMonth: 10,
        customDomainEnabled: false,
        prioritySupport: false,
        analyticsEnabled: false,
        monthlyPrice: 0,
        yearlyPrice: 0,
      },
    ],
    [
      SubscriptionPlan.STARTER,
      {
        plan: SubscriptionPlan.STARTER,
        name: 'Starter',
        description: 'For growing businesses',
        maxProjects: 10,
        maxDeploymentsPerMonth: 500,
        customDomainEnabled: true,
        prioritySupport: false,
        analyticsEnabled: true,
        monthlyPrice: 19,
        yearlyPrice: 190,
      },
    ],
    [
      SubscriptionPlan.PRO,
      {
        plan: SubscriptionPlan.PRO,
        name: 'Pro',
        description: 'For professional teams',
        maxProjects: 50,
        maxDeploymentsPerMonth: 2000,
        customDomainEnabled: true,
        prioritySupport: true,
        analyticsEnabled: true,
        monthlyPrice: 49,
        yearlyPrice: 490,
      },
    ],
    [
      SubscriptionPlan.ENTERPRISE,
      {
        plan: SubscriptionPlan.ENTERPRISE,
        name: 'Enterprise',
        description: 'For large organizations',
        maxProjects: -1, // unlimited
        maxDeploymentsPerMonth: -1, // unlimited
        customDomainEnabled: true,
        prioritySupport: true,
        analyticsEnabled: true,
        monthlyPrice: 199,
        yearlyPrice: 1990,
      },
    ],
  ]);

  constructor(private readonly configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    });

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    this.webhookSecret = webhookSecret;

    // Set plan-specific price IDs from environment
    this.initializePlanPriceIds();
  }

  /**
   * Initialize price IDs for each plan from environment variables
   */
  private initializePlanPriceIds(): void {
    const planEnvMapping: Record<SubscriptionPlan, string> = {
      [SubscriptionPlan.FREE]: '', // Free plan has no prices
      [SubscriptionPlan.STARTER]: 'STARTER',
      [SubscriptionPlan.PRO]: 'PRO',
      [SubscriptionPlan.ENTERPRISE]: 'ENTERPRISE',
    };

    for (const [planType, envPrefix] of Object.entries(planEnvMapping)) {
      if (!envPrefix) {
        continue; // Skip FREE plan
      }

      const plan = this.plans.get(planType as SubscriptionPlan);
      if (!plan) {
        continue;
      }

      const monthlyPriceId = this.configService.get<string>(`STRIPE_PRICE_${envPrefix}_MONTHLY`);
      const yearlyPriceId = this.configService.get<string>(`STRIPE_PRICE_${envPrefix}_YEARLY`);

      if (monthlyPriceId) {
        plan.stripePriceIdMonthly = monthlyPriceId;
      }

      if (yearlyPriceId) {
        plan.stripePriceIdYearly = yearlyPriceId;
      }

      this.logger.log(
        `Plan ${planType}: Monthly=${monthlyPriceId ? 'configured' : 'not set'}, Yearly=${yearlyPriceId ? 'configured' : 'not set'}`,
      );
    }
  }

  /**
   * Create or get a Stripe customer for a user
   */
  async createOrGetCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    // Search for existing customer
    const existingCustomers = await this.stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        user_id: userId,
      },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
    return customer;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    customerId: string,
    plan: SubscriptionPlan,
    billingInterval: BillingInterval,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    const planConfig = this.plans.get(plan);

    if (!planConfig) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    if (plan === SubscriptionPlan.FREE) {
      throw new Error('Cannot create checkout session for free plan');
    }

    const priceId =
      billingInterval === BillingInterval.MONTHLY
        ? planConfig.stripePriceIdMonthly
        : planConfig.stripePriceIdYearly;

    if (!priceId) {
      throw new Error(`No Stripe price configured for ${plan} ${billingInterval} plan`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          plan,
          billing_interval: billingInterval,
        },
      },
    });

    this.logger.log(`Created checkout session ${session.id} for customer ${customerId}`);
    return session;
  }

  /**
   * Create a customer portal session for managing subscription
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    this.logger.log(`Created portal session for customer ${customerId}`);
    return session;
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivate a subscription that's set to cancel at period end
   */
  reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(
    subscriptionId: string,
    newPlan: SubscriptionPlan,
    billingInterval: BillingInterval,
  ): Promise<Stripe.Subscription> {
    const planConfig = this.plans.get(newPlan);

    if (!planConfig) {
      throw new Error(`Unknown plan: ${newPlan}`);
    }

    const priceId =
      billingInterval === BillingInterval.MONTHLY
        ? planConfig.stripePriceIdMonthly
        : planConfig.stripePriceIdYearly;

    if (!priceId) {
      throw new Error(`No Stripe price configured for ${newPlan} ${billingInterval} plan`);
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    return this.stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        plan: newPlan,
        billing_interval: billingInterval,
      },
    });
  }

  /**
   * Get subscription from Stripe
   */
  getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Verify webhook signature and return event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  /**
   * Map Stripe subscription status to our status
   */
  mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      past_due: SubscriptionStatus.PAST_DUE,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }

  /**
   * Get plan config by plan type
   */
  getPlanConfig(plan: SubscriptionPlan): PlanConfig | undefined {
    return this.plans.get(plan);
  }

  /**
   * Get all available plans
   */
  getAllPlans(): PlanConfig[] {
    return Array.from(this.plans.values());
  }

  /**
   * Create a Stripe product for a license
   * Product name is the license ID for easy reference
   */
  async createLicenseProduct(
    licenseId: string,
    licenseName: string,
    description: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Product> {
    const product = await this.stripe.products.create({
      name: licenseId, // Using license ID as product name for easy lookup
      description: description || licenseName,
      metadata: {
        license_id: licenseId,
        license_name: licenseName,
        ...metadata,
      },
    });

    this.logger.log(`Created Stripe product ${product.id} for license ${licenseId}`);
    return product;
  }

  /**
   * Create a Stripe price for a license product
   */
  async createLicensePrice(
    productId: string,
    amount: number,
    currency: string,
    licenseId: string,
  ): Promise<Stripe.Price> {
    // Convert amount to cents (Stripe uses smallest currency unit)
    const unitAmount = Math.round(amount * 100);

    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      metadata: {
        license_id: licenseId,
      },
    });

    this.logger.log(`Created Stripe price ${price.id} for product ${productId}`);
    return price;
  }

  /**
   * Update a Stripe product
   */
  async updateLicenseProduct(
    productId: string,
    updates: {
      name?: string;
      description?: string;
      active?: boolean;
      metadata?: Record<string, string>;
    },
  ): Promise<Stripe.Product> {
    const product = await this.stripe.products.update(productId, updates);
    this.logger.log(`Updated Stripe product ${productId}`);
    return product;
  }

  /**
   * Create a new price for an existing product (prices are immutable in Stripe)
   * Deactivates the old price if provided
   */
  async updateLicensePrice(
    productId: string,
    newAmount: number,
    currency: string,
    licenseId: string,
    oldPriceId?: string,
  ): Promise<Stripe.Price> {
    // Create new price
    const newPrice = await this.createLicensePrice(productId, newAmount, currency, licenseId);

    // Deactivate old price if provided
    if (oldPriceId) {
      await this.stripe.prices.update(oldPriceId, { active: false });
      this.logger.log(`Deactivated old price ${oldPriceId}`);
    }

    return newPrice;
  }

  /**
   * Archive/deactivate a Stripe product
   */
  async archiveLicenseProduct(productId: string): Promise<Stripe.Product> {
    const product = await this.stripe.products.update(productId, { active: false });
    this.logger.log(`Archived Stripe product ${productId}`);
    return product;
  }

  /**
   * Create a checkout session for purchasing a license (one-time payment)
   */
  async createLicenseCheckoutSession(
    customerId: string,
    priceId: string,
    licenseId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Checkout.Session> {
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        license_id: licenseId,
        type: 'license_purchase',
        ...metadata,
      },
    });

    this.logger.log(`Created license checkout session ${session.id} for license ${licenseId}`);
    return session;
  }
}
