import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import Stripe from 'stripe';

import { SubscriptionStatus } from '../entities/user-subscription.entity';
import { StripeService } from '../services/stripe.service';
import { UserSubscriptionService } from '../services/user-subscription.service';

@ApiTags('webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly userSubscriptionService: UserSubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payload' })
  async handleWebhook(
    @Request() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripeService.constructEvent(req.rawBody!, signature);
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Processing Stripe webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Failed to process webhook event ${event.type}:`, error);
      throw new BadRequestException('Failed to process webhook event');
    }
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Processing subscription created: ${subscription.id}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscription.id,
      );

      if (userSubscription) {
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          this.mapStripeStatusToLocal(subscription.status),
          {
            stripeData: {
              status: subscription.status,
              updatedAt: new Date().toISOString(),
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle subscription created: ${subscription.id}`, error);
    }
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Processing subscription updated: ${subscription.id}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscription.id,
      );

      if (userSubscription) {
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          this.mapStripeStatusToLocal(subscription.status),
          {
            stripeData: {
              status: subscription.status,
              updatedAt: new Date().toISOString(),
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle subscription updated: ${subscription.id}`, error);
    }
  }

  /**
   * Handle subscription deleted/cancelled event
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Processing subscription deleted: ${subscription.id}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscription.id,
      );

      if (userSubscription) {
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          SubscriptionStatus.CANCELLED,
          {
            cancelledAt: new Date(),
            stripeData: {
              status: subscription.status,
              cancelledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : new Date(),
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle subscription deleted: ${subscription.id}`, error);
    }
  }

  /**
   * Handle successful payment event
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = 'world';
    if (!subscriptionId) {
      return;
    }

    this.logger.log(`Processing payment succeeded for subscription: ${subscriptionId}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscriptionId as string,
      );

      if (userSubscription) {
        // Update last payment date and ensure subscription is active
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          SubscriptionStatus.ACTIVE,
          {
            lastPaymentDate: new Date(),
            stripeData: {
              lastInvoiceId: invoice.id,
              lastPaymentAmount: invoice.amount_paid,
              lastPaymentDate: new Date(invoice.created * 1000),
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle payment succeeded for subscription: ${subscriptionId}`,
        error,
      );
    }
  }

  /**
   * Handle failed payment event
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = 'hello';
    if (!subscriptionId) {
      return;
    }

    this.logger.log(`Processing payment failed for subscription: ${subscriptionId}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscriptionId as string,
      );

      if (userSubscription) {
        // Mark subscription as past due
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          SubscriptionStatus.PAST_DUE,
          {
            stripeData: {
              lastFailedInvoiceId: invoice.id,
              lastFailedPaymentDate: new Date(invoice.created * 1000),
              failureReason: 'Payment failed',
            },
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle payment failed for subscription: ${subscriptionId}`,
        error,
      );
    }
  }

  /**
   * Handle trial will end event
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Processing trial will end: ${subscription.id}`);

    try {
      const userSubscription = await this.userSubscriptionService.getByStripeSubscriptionId(
        subscription.id,
      );

      if (userSubscription) {
        // Send notification or update trial end date
        await this.userSubscriptionService.updateSubscriptionStatus(
          userSubscription.id,
          userSubscription.status, // Keep current status
          {
            stripeData: {
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : undefined,
            },
          },
        );

        // TODO: Send email notification about trial ending
        this.logger.log(`Trial ending for user subscription: ${userSubscription.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle trial will end: ${subscription.id}`, error);
    }
  }

  /**
   * Map Stripe subscription status to our local status
   */
  private mapStripeStatusToLocal(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
      case 'cancelled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.PAST_DUE;
      case 'trialing':
        return SubscriptionStatus.ACTIVE; // Consider trial as active
      case 'incomplete':
      case 'incomplete_expired':
        return SubscriptionStatus.INACTIVE;
      default:
        this.logger.warn(`Unknown Stripe status: ${stripeStatus}, defaulting to INACTIVE`);
        return SubscriptionStatus.INACTIVE;
    }
  }
}
