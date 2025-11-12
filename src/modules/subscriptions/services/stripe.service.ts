import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { User } from '../../users/entities/user.entity';

export interface StripeCustomerData {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscriptionData {
  id: string;
  customerId: string;
  priceId: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-06-30.basil',
    });
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createOrGetCustomer(
    user: User,
    existingStripeCustomerId?: string,
  ): Promise<StripeCustomerData> {
    try {
      // Check if we have an existing Stripe customer ID
      if (existingStripeCustomerId) {
        const customer = await this.stripe.customers.retrieve(existingStripeCustomerId);

        if (!customer.deleted) {
          return {
            id: customer.id,
            email: customer.email || user.email,
            name: customer.name || this.getFullName(user),
            metadata: customer.metadata,
          };
        }
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: this.getFullName(user),
        metadata: {
          userId: user.id,
          createdAt: new Date().toISOString(),
        },
      });

      this.logger.log(`Created Stripe customer ${customer.id} for user ${user.id}`);

      return {
        id: customer.id,
        email: customer.email || user.email,
        name: customer.name || this.getFullName(user),
        metadata: customer.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to create/get Stripe customer for user ${user.id}:`, error);
      throw new BadRequestException('Failed to create payment customer');
    }
  }

  /**
   * Helper method to get user's full name
   */
  private getFullName(user: User): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.lastName) {
      return user.lastName;
    }
    return user.email.split('@')[0]; // Fallback to email username
  }

  /**
   * Create a Stripe subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    options?: {
      paymentMethodId?: string;
      trialPeriodDays?: number;
      metadata?: Record<string, string>;
    },
  ): Promise<StripeSubscriptionData> {
    try {
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: options?.metadata || {},
      };

      if (options?.paymentMethodId) {
        subscriptionParams.default_payment_method = options.paymentMethodId;
        subscriptionParams.payment_behavior = 'default_incomplete';
        subscriptionParams.payment_settings = {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        };
      }

      if (options?.trialPeriodDays) {
        subscriptionParams.trial_period_days = options.trialPeriodDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      this.logger.log(`Created Stripe subscription ${subscription.id} for customer ${customerId}`);

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        priceId: subscription.items.data[0].price.id,
        status: subscription.status,
        metadata: subscription.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to create Stripe subscription:`, error);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  /**
   * Update a Stripe subscription (for upgrades/downgrades)
   */
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
    options?: {
      prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
      metadata?: Record<string, string>;
    },
  ): Promise<StripeSubscriptionData> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: options?.prorationBehavior || 'create_prorations',
        metadata: options?.metadata || {},
      });

      this.logger.log(`Updated Stripe subscription ${subscriptionId} to price ${newPriceId}`);

      return {
        id: updatedSubscription.id,
        customerId: updatedSubscription.customer as string,
        priceId: updatedSubscription.items.data[0].price.id,
        status: updatedSubscription.status,
        metadata: updatedSubscription.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to update Stripe subscription ${subscriptionId}:`, error);
      throw new BadRequestException('Failed to update subscription');
    }
  }

  /**
   * Cancel a Stripe subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    options?: {
      cancelAtPeriodEnd?: boolean;
      cancellationReason?: string;
    },
  ): Promise<StripeSubscriptionData> {
    try {
      let subscription: Stripe.Subscription;

      if (options?.cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
          metadata: {
            cancellation_reason: options.cancellationReason || 'user_requested',
          },
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
          invoice_now: true,
          prorate: true,
        });
      }

      this.logger.log(`Cancelled Stripe subscription ${subscriptionId}`);

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        priceId: subscription.items.data[0].price.id,
        status: subscription.status,
        metadata: subscription.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to cancel Stripe subscription ${subscriptionId}:`, error);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  /**
   * Create a payment intent for one-time payments
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId: string,
    metadata?: Record<string, string>,
  ): Promise<CreatePaymentIntentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error(`Failed to create payment intent:`, error);
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  /**
   * Retrieve subscription from Stripe
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscriptionData> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        priceId: subscription.items.data[0].price.id,
        status: subscription.status,
        metadata: subscription.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve Stripe subscription ${subscriptionId}:`, error);
      throw new NotFoundException('Subscription not found');
    }
  }

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent(
    customerId: string,
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      return {
        clientSecret: setupIntent.client_secret!,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      this.logger.error(`Failed to create setup intent for customer ${customerId}:`, error);
      throw new BadRequestException('Failed to create setup intent');
    }
  }

  /**
   * Get customer's payment methods
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      this.logger.error(`Failed to get payment methods for customer ${customerId}:`, error);
      throw new BadRequestException('Failed to retrieve payment methods');
    }
  }

  /**
   * Construct event from webhook payload (for webhook handling)
   */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook processing');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      this.logger.error('Failed to construct Stripe webhook event:', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      this.logger.error(
        `Failed to create billing portal session for customer ${customerId}:`,
        error,
      );
      throw new BadRequestException('Failed to create billing portal session');
    }
  }
}
