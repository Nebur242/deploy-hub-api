import { EnvironmentVariables } from '@app/config/env.validation';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { ConfirmPaymentDto, CreatePaymentIntentDto } from '../dto';

/**
 * StripeService handles all Stripe payment operations
 * This is the integration layer between the NestJS application and Stripe API
 *
 * @see https://stripe.com/docs/stripe-js/react
 * @see https://stripe.com/docs/payments/payment-intents
 */
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService<EnvironmentVariables>) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY', { infer: true });

    if (!secretKey) {
      throw new InternalServerErrorException(
        'STRIPE_SECRET_KEY is not configured in environment variables',
      );
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Create a payment intent with Stripe
   * Payment intents are the core Stripe object for handling payments
   *
   * @param dto - CreatePaymentIntentDto containing order and user information
   * @returns Payment intent with client secret for frontend
   *
   * @throws BadRequestException if required parameters are missing
   * @throws InternalServerErrorException if Stripe API call fails
   *
   * @example
   * // Frontend will receive this response
   * {
   *   clientSecret: "pi_1234567890_secret_987654321",
   *   paymentIntentId: "pi_1234567890",
   *   status: "requires_payment_method",
   *   amount: 9999,
   *   currency: "usd"
   * }
   */
  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    if (!createPaymentIntentDto.amount || createPaymentIntentDto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (!createPaymentIntentDto.currency) {
      throw new BadRequestException('Currency is required');
    }

    if (!createPaymentIntentDto.orderId) {
      throw new BadRequestException('Order ID is required');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(createPaymentIntentDto.amount * 100),
        currency: createPaymentIntentDto.currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: createPaymentIntentDto.orderId,
          userId: createPaymentIntentDto.userId,
          customerEmail: createPaymentIntentDto.customerEmail || '',
          licenseId: createPaymentIntentDto.licenseId || '',
        },
        receipt_email: createPaymentIntentDto.customerEmail,
        statement_descriptor: this.formatStatementDescriptor('DeployHub License'),
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: createPaymentIntentDto.amount,
        currency: createPaymentIntentDto.currency,
      };
    } catch (e) {
      const error = e as Error & { message: string };
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to create payment intent with Stripe');
    }
  }

  /**
   * Confirm a payment intent
   * This retrieves the payment intent status from Stripe after frontend has confirmed it
   *
   * @param dto - ConfirmPaymentDto containing payment intent ID
   * @returns Confirmed payment intent details
   *
   * @throws BadRequestException if payment intent ID is invalid
   * @throws InternalServerErrorException if Stripe API call fails
   *
   * @example
   * // Frontend sends the confirmed payment intent ID
   * {
   *   paymentIntentId: "pi_1234567890"
   * }
   *
   * // Response shows payment status
   * {
   *   paymentIntentId: "pi_1234567890",
   *   status: "succeeded",
   *   amount: 9999,
   *   currency: "usd",
   *   chargeId: "ch_1234567890"
   * }
   */
  async confirmPayment(confirmPaymentDto: ConfirmPaymentDto) {
    if (!confirmPaymentDto.paymentIntentId) {
      throw new BadRequestException('Payment intent ID is required');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        confirmPaymentDto.paymentIntentId,
      );

      // Get charge ID from the payment intent's latest charge
      const chargeId: string | null =
        typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : null;

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        chargeId,
        created: paymentIntent.created,
        metadata: paymentIntent.metadata || {},
      };
    } catch (e) {
      const error = e as Error & { type: string; message: string };
      if (error.type === 'StripeInvalidRequestError') {
        throw new BadRequestException('Invalid payment intent ID');
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to confirm payment with Stripe');
    }
  }

  /**
   * Retrieve payment intent details
   * Use this to check payment status at any time
   *
   * @param paymentIntentId - The Stripe payment intent ID
   * @returns Payment intent details
   *
   * @throws BadRequestException if payment intent is not found
   */
  async getPaymentIntent(paymentIntentId: string) {
    if (!paymentIntentId) {
      throw new BadRequestException('Payment intent ID is required');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata || {},
        created: paymentIntent.created,
      };
    } catch (e) {
      const error = e as Error & { type: string; message: string };
      if (error.type === 'StripeInvalidRequestError') {
        throw new BadRequestException('Payment intent not found');
      }

      throw new InternalServerErrorException('Failed to retrieve payment intent');
    }
  }

  /**
   * Refund a charge
   * Use this to process refunds for completed payments
   *
   * @param chargeId - The Stripe charge ID to refund
   * @param amount - Optional: amount to refund in cents (full refund if not specified)
   * @returns Refund details
   */
  async refundCharge(chargeId: string, amount?: number) {
    if (!chargeId) {
      throw new BadRequestException('Charge ID is required');
    }

    try {
      const refund = await this.stripe.refunds.create({
        charge: chargeId,
        ...(amount && { amount }),
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amount: (refund.amount / 100).toFixed(2),
        chargeId: refund.charge as string,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Refund failed: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  /**
   * Create a webhook endpoint signature verification
   * This is used to verify webhook authenticity
   *
   * @param body - Raw request body
   * @param signature - Stripe signature header
   * @returns Verified event object
   *
   * @throws BadRequestException if signature is invalid
   */
  verifyWebhookSignature(body: string | Buffer, signature: string) {
    const webhookSecret = this.getWebhookSecret();

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);

      return event;
    } catch (e) {
      const error = e as Error & { message: string };
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Format statement descriptor for credit card statement
   * Stripe requires max 22 characters, this ensures we don't exceed that
   *
   * @param descriptor - Original descriptor
   * @returns Truncated descriptor (max 22 chars)
   */
  private formatStatementDescriptor(descriptor: string): string {
    // Remove special characters and spaces, keep only alphanumeric
    let formatted = descriptor.replace(/[^\w\s*.-]/g, '').trim();

    // Truncate to 22 characters (Stripe limit)
    if (formatted.length > 22) {
      formatted = formatted.substring(0, 22);
    }

    return formatted || 'DeployHub';
  }

  /**
   * Check if Stripe is properly configured
   * Use this for health checks and startup validation
   *
   * @returns true if Stripe is configured, false otherwise
   */
  isConfigured(): boolean {
    return !!this.configService.get('STRIPE_SECRET_KEY', { infer: true });
  }

  /**
   * Get Stripe publishable key (for frontend initialization)
   * This is safe to share with frontend as it's public
   *
   * @returns Stripe publishable key
   * @throws InternalServerErrorException if not configured
   */
  getPublishableKey(): string {
    const publishableKey = this.configService.get('STRIPE_PUBLISHABLE_KEY', { infer: true });

    if (!publishableKey) {
      throw new InternalServerErrorException('STRIPE_PUBLISHABLE_KEY is not configured');
    }

    return publishableKey;
  }

  /**
   * Get Stripe webhook secret for verifying webhook signatures
   *
   * @returns Stripe webhook secret
   * @throws InternalServerErrorException if not configured
   */
  private getWebhookSecret(): string {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET', { infer: true });

    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return webhookSecret;
  }

  /**
   * Create or get a Stripe customer for a user
   */
  async createOrGetCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    // Search for existing customer by email
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

    return customer;
  }

  /**
   * Create a Stripe Checkout Session for license purchase
   * Handles both one-time payments (forever) and subscriptions (monthly/yearly)
   *
   * @param params - Checkout session parameters
   * @returns Stripe Checkout Session with URL
   */
  async createLicenseCheckoutSession(params: {
    customerId: string;
    orderId: string;
    licenseId: string;
    licenseName: string;
    amount: number;
    currency: string;
    period: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
  }): Promise<{ sessionId: string; url: string }> {
    const {
      customerId,
      orderId,
      licenseId,
      licenseName,
      amount,
      currency,
      period,
      successUrl,
      cancelUrl,
      customerEmail,
      metadata,
    } = params;

    const isSubscription = period !== 'forever';

    // Create price data inline (for dynamic pricing)
    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
      currency: currency.toLowerCase(),
      unit_amount: Math.round(amount * 100), // Convert to cents
      product_data: {
        name: licenseName,
        description: `License: ${licenseName}`,
        metadata: {
          license_id: licenseId,
        },
      },
    };

    // Add recurring configuration for subscriptions
    if (isSubscription) {
      priceData.recurring = {
        interval: this.mapPeriodToStripeInterval(period),
        interval_count: period === 'biweekly' ? 2 : 1,
      };
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: {
        order_id: orderId,
        license_id: licenseId,
        type: isSubscription ? 'license_subscription' : 'license_purchase',
        period: period,
        ...metadata,
      },
      ...(isSubscription && {
        subscription_data: {
          metadata: {
            order_id: orderId,
            license_id: licenseId,
            period: period,
          },
        },
      }),
      ...(!isSubscription && {
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            license_id: licenseId,
          },
        },
      }),
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      throw new InternalServerErrorException('Failed to create checkout session URL');
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Map license period to Stripe billing interval
   */
  private mapPeriodToStripeInterval(
    period: string,
  ): Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval {
    switch (period) {
      case 'weekly':
      case 'biweekly':
        return 'week';
      case 'monthly':
        return 'month';
      case 'yearly':
        return 'year';
      default:
        return 'month';
    }
  }

  /**
   * Retrieve a Checkout Session by ID
   */
  getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent'],
    });
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
   * Get subscription details
   */
  getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Get the Stripe instance (for webhook handling)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}
