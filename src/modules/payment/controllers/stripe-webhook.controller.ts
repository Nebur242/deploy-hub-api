import { UserLicense } from '@app/modules/license/entities/user-license.entity';
import { LicenseService } from '@app/modules/license/services/license.service';
import { OrderService } from '@app/modules/order/services/order.service';
import { OrderStatus, PaymentStatus, PaymentMethod, LicensePeriod } from '@app/shared/enums';
import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Repository } from 'typeorm';

import { Payment } from '../entities/payment.entity';
import { StripeService } from '../services/stripe.service';

// Define status enum locally to avoid import ordering issues
enum UserLicenseStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  PAUSED = 'paused',
}

@ApiTags('webhooks')
@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly orderService: OrderService,
    private readonly licenseService: LicenseService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
  ) {}

  @Post('stripe')
  @ApiExcludeEndpoint() // Hide from Swagger since it's called by Stripe
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Get raw body for signature verification
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException('No raw body available');
      }

      event = this.stripeService.verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException(`Webhook signature verification failed`);
    }

    this.logger.log(`Received Stripe webhook event: ${event.type}`);

    try {
      const eventData = event.data.object;

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(eventData as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(eventData as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(eventData as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(eventData as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(eventData as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(eventData as Stripe.Invoice);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      this.logger.error(`Error handling webhook: ${(err as Error).message}`, (err as Error).stack);
      // Return 200 to acknowledge receipt (Stripe will retry on non-200)
      // but log the error for debugging
      return res.status(200).json({ received: true, error: (err as Error).message });
    }
  }

  /**
   * Handle successful checkout session completion
   * This fires for both one-time payments and subscription initial payments
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`Checkout session completed: ${session.id}`);

    const orderId = session.metadata?.order_id;
    const licenseId = session.metadata?.license_id;
    const isSubscription = session.mode === 'subscription';

    if (!orderId) {
      this.logger.warn('No order_id in checkout session metadata');
      return;
    }

    // Get the order
    const order = await this.orderService.findOne(orderId);
    if (!order) {
      this.logger.warn(`Order not found: ${orderId}`);
      return;
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      order_id: orderId,
      amount: order.amount,
      currency: order.currency,
      payment_method: PaymentMethod.STRIPE,
      transaction_id: isSubscription
        ? (session.subscription as string)
        : (session.payment_intent as string),
      payment_gateway_response: JSON.stringify({
        session_id: session.id,
        mode: session.mode,
        payment_status: session.payment_status,
        customer: session.customer,
      }),
      status: PaymentStatus.COMPLETED,
      processed_at: new Date(),
    });

    await this.paymentRepository.save(payment);

    // Update order status to completed
    await this.orderService.updateStatus(orderId, OrderStatus.COMPLETED);

    // Create UserLicense
    const license = await this.licenseService.findOne(licenseId || order.license_id);

    const userLicense = this.userLicenseRepository.create({
      owner_id: order.user_id,
      license_id: license.id,
      active: true,
      status: UserLicenseStatus.ACTIVE,
      count: 0,
      max_deployments: license.deployment_limit,
      deployments: [],
      trial: false,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: isSubscription ? (session.subscription as string) : undefined,
      metadata: {
        orderReference: order.reference_number,
        paymentId: payment.id,
        paymentDate: new Date().toISOString(),
        checkoutSessionId: session.id,
        isSubscription,
        licensePeriod: license.period,
      },
    });

    // Set expiration for subscription licenses
    if (isSubscription && license.period !== LicensePeriod.FOREVER) {
      // Will be updated by subscription webhook with actual period end
      const expiresAt = new Date();
      switch (license.period) {
        case LicensePeriod.WEEKLY:
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
        case LicensePeriod.BIWEEKLY:
          expiresAt.setDate(expiresAt.getDate() + 14);
          break;
        case LicensePeriod.MONTHLY:
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          break;
        case LicensePeriod.YEARLY:
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
      }
      userLicense.expires_at = expiresAt;
    }

    await this.userLicenseRepository.save(userLicense);

    this.logger.log(`Created user license for order ${orderId}, subscription: ${isSubscription}`);
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    this.logger.log(`Subscription created: ${subscription.id}`);

    // Find the user license by subscription ID
    const userLicense = await this.userLicenseRepository.findOne({
      where: { stripe_subscription_id: subscription.id },
    });

    if (!userLicense) {
      // License might not be created yet if webhook arrives before checkout completion
      this.logger.log(
        `User license not found for subscription ${subscription.id}, will be created on checkout completion`,
      );
      return;
    }

    // Update with subscription details - cast to any for Stripe API compatibility
    const sub = subscription as unknown as {
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };
    userLicense.current_period_start = new Date(sub.current_period_start * 1000);
    userLicense.current_period_end = new Date(sub.current_period_end * 1000);
    userLicense.expires_at = new Date(sub.current_period_end * 1000);
    userLicense.cancel_at_period_end = sub.cancel_at_period_end;

    await this.userLicenseRepository.save(userLicense);
  }

  /**
   * Map Stripe subscription status to UserLicenseStatus
   */
  private mapStripeStatusToUserLicenseStatus(stripeStatus: string): UserLicenseStatus {
    const statusMap: Record<string, UserLicenseStatus> = {
      active: UserLicenseStatus.ACTIVE,
      canceled: UserLicenseStatus.CANCELLED,
      past_due: UserLicenseStatus.PAST_DUE,
      paused: UserLicenseStatus.PAUSED,
      unpaid: UserLicenseStatus.PAST_DUE,
    };

    return statusMap[stripeStatus] || UserLicenseStatus.ACTIVE;
  }

  /**
   * Handle subscription updated event (renewal, plan change, cancellation scheduled)
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    this.logger.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);

    const userLicense = await this.userLicenseRepository.findOne({
      where: { stripe_subscription_id: subscription.id },
    });

    if (!userLicense) {
      this.logger.warn(`User license not found for subscription ${subscription.id}`);
      return;
    }

    // Cast to any for Stripe API compatibility
    const sub = subscription as unknown as {
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };

    userLicense.status = this.mapStripeStatusToUserLicenseStatus(subscription.status);
    userLicense.active = subscription.status === 'active';
    userLicense.current_period_start = new Date(sub.current_period_start * 1000);
    userLicense.current_period_end = new Date(sub.current_period_end * 1000);
    userLicense.expires_at = new Date(sub.current_period_end * 1000);
    userLicense.cancel_at_period_end = sub.cancel_at_period_end;

    await this.userLicenseRepository.save(userLicense);

    this.logger.log(`Updated user license ${userLicense.id}, status: ${userLicense.status}`);
  }

  /**
   * Handle subscription deleted event (cancelled and period ended)
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    const userLicense = await this.userLicenseRepository.findOne({
      where: { stripe_subscription_id: subscription.id },
    });

    if (!userLicense) {
      this.logger.warn(`User license not found for subscription ${subscription.id}`);
      return;
    }

    userLicense.status = UserLicenseStatus.CANCELLED;
    userLicense.active = false;

    await this.userLicenseRepository.save(userLicense);

    this.logger.log(`Cancelled user license ${userLicense.id}`);
  }

  /**
   * Extract subscription ID from invoice
   */
  private getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    // Cast invoice for Stripe API compatibility
    const inv = invoice as unknown as { subscription?: string | { id: string } };
    const subscription = inv.subscription;
    if (!subscription) {
      return null;
    }
    if (typeof subscription === 'string') {
      return subscription;
    }
    // It's an expanded subscription object
    return subscription.id;
  }

  /**
   * Handle successful invoice payment (subscription renewal)
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    this.logger.log(`Invoice paid: ${invoice.id}`);

    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      // One-time payment invoice, handled by checkout.session.completed
      return;
    }

    const userLicense = await this.userLicenseRepository.findOne({
      where: { stripe_subscription_id: subscriptionId },
    });

    if (!userLicense) {
      this.logger.warn(`User license not found for subscription ${subscriptionId}`);
      return;
    }

    // Ensure license is active after successful payment
    userLicense.status = UserLicenseStatus.ACTIVE;
    userLicense.active = true;

    // Get subscription details for period updates - cast for Stripe API compatibility
    const subscription = await this.stripeService.getSubscription(subscriptionId);
    const sub = subscription as unknown as {
      current_period_start: number;
      current_period_end: number;
    };
    userLicense.current_period_start = new Date(sub.current_period_start * 1000);
    userLicense.current_period_end = new Date(sub.current_period_end * 1000);
    userLicense.expires_at = new Date(sub.current_period_end * 1000);

    await this.userLicenseRepository.save(userLicense);

    this.logger.log(
      `Renewed user license ${userLicense.id} until ${userLicense.expires_at?.toISOString()}`,
    );
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.log(`Invoice payment failed: ${invoice.id}`);

    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    const userLicense = await this.userLicenseRepository.findOne({
      where: { stripe_subscription_id: subscriptionId },
    });

    if (!userLicense) {
      this.logger.warn(`User license not found for subscription ${subscriptionId}`);
      return;
    }

    userLicense.status = UserLicenseStatus.PAST_DUE;
    // Keep active for now to allow grace period - Stripe will handle retries

    await this.userLicenseRepository.save(userLicense);

    this.logger.log(`Marked user license ${userLicense.id} as past due`);
  }
}
