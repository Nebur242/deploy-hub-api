import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import {
  DeploymentCompletedEvent,
  DeploymentCreatedEvent,
  DeploymentEventType,
  DeploymentFailedEvent,
} from '../../deployments/events/deployment.events';
import {
  OrderCancelledEvent,
  OrderCompletedEvent,
  OrderCreatedEvent,
  OrderEventType,
  OrderFailedEvent,
  OrderRefundedEvent,
} from '../../order/events/order.events';
import { UserCreatedEvent, UserEventType } from '../../users/events/user.events';
import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationService } from '../services/notification.service';

/**
 * Helper function to extract error message and stack from unknown error
 */
function getErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * Service that listens to events and creates notifications
 */
@Injectable()
export class NotificationEventListenerService {
  private readonly logger = new Logger(NotificationEventListenerService.name);
  private readonly userDashboardUrl: string;
  private readonly ownerDashboardUrl: string;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    this.userDashboardUrl =
      this.configService.get<string>('USER_DASHBOARD_URL') || 'https://app.deployhub.com';
    this.ownerDashboardUrl =
      this.configService.get<string>('OWNER_DASHBOARD_URL') || 'https://owner.deployhub.com';
  }

  // ==================== USER EVENTS ====================

  @OnEvent(UserEventType.USER_CREATED)
  async handleUserCreated(event: UserCreatedEvent) {
    this.logger.log(`Handling user created event for user: ${event.userId}`);

    try {
      // Send welcome email
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.WELCOME,
        userId: event.userId,
        recipient: event.email,
        subject: 'Welcome to Deploy Hub!',
        message: `Welcome ${event.firstName}! Thank you for joining Deploy Hub. Start exploring and deploying your projects today.`,
        data: {
          firstName: event.firstName,
          lastName: event.lastName,
          email: event.email,
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Send system notification
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.WELCOME,
        userId: event.userId,
        subject: 'Welcome to Deploy Hub!',
        message: `Welcome ${event.firstName}! Your account has been created successfully.`,
        data: {
          firstName: event.firstName,
          type: 'welcome',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send welcome notification: ${message}`, stack);
    }
  }

  // ==================== ORDER EVENTS ====================

  @OnEvent(OrderEventType.ORDER_CREATED)
  async handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(`Handling order created event for order: ${event.orderId}`);

    try {
      // Notify buyer
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        recipient: event.buyerEmail,
        subject: `Order Confirmation - ${event.licenseName}`,
        message: `Your order for ${event.licenseName} has been created. Please complete the payment to activate your license.`,
        data: {
          orderId: event.orderId,
          orderReference: event.order.reference_number,
          licenseName: event.licenseName,
          amount: event.order.amount,
          currency: event.order.currency,
          buyerName: event.buyerName,
          status: 'pending',
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Notify owner about new order
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.SALE,
        userId: event.licenseOwnerId,
        subject: 'New Order Received',
        message: `You have a new order for ${event.licenseName} from ${event.buyerName}.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          buyerName: event.buyerName,
          amount: event.order.amount,
          currency: event.order.currency,
          type: 'new_order',
          dashboardUrl: this.ownerDashboardUrl,
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send order created notification: ${message}`, stack);
    }
  }

  @OnEvent(OrderEventType.ORDER_COMPLETED)
  async handleOrderCompleted(event: OrderCompletedEvent) {
    this.logger.log(`Handling order completed event for order: ${event.orderId}`);

    try {
      // Notify buyer - Email
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        recipient: event.buyerEmail,
        subject: `Payment Successful - ${event.licenseName}`,
        message: `Your payment for ${event.licenseName} has been processed successfully. Your license is now active.`,
        data: {
          orderId: event.orderId,
          orderReference: event.order.reference_number,
          licenseName: event.licenseName,
          amount: event.amount,
          currency: event.currency,
          buyerName: event.buyerName,
          status: 'completed',
          completedAt: event.timestamp.toISOString(),
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Notify buyer - System
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        subject: 'Purchase Complete',
        message: `Your purchase of ${event.licenseName} is complete. You can now access your license.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          type: 'purchase_complete',
        },
      });

      // Notify owner - Email
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.SALE,
        userId: event.licenseOwnerId,
        recipient: event.ownerEmail,
        subject: `New Sale - ${event.licenseName}`,
        message: `Great news! ${event.buyerName} just purchased ${event.licenseName} for ${event.currency} ${event.amount}.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          buyerName: event.buyerName,
          amount: event.amount,
          currency: event.currency,
          ownerName: event.ownerName,
          status: 'sale_completed',
          dashboardUrl: this.ownerDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Notify owner - System
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.SALE,
        userId: event.licenseOwnerId,
        subject: 'New Sale!',
        message: `${event.buyerName} purchased ${event.licenseName} for ${event.currency} ${event.amount}`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          amount: event.amount,
          currency: event.currency,
          type: 'sale_completed',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send order completed notification: ${message}`, stack);
    }
  }

  @OnEvent(OrderEventType.ORDER_FAILED)
  async handleOrderFailed(event: OrderFailedEvent) {
    this.logger.log(`Handling order failed event for order: ${event.orderId}`);

    try {
      // Notify buyer
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        recipient: event.buyerEmail,
        subject: `Payment Failed - ${event.licenseName}`,
        message: `Unfortunately, your payment for ${event.licenseName} could not be processed. Please try again or contact support.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          buyerName: event.buyerName,
          errorMessage: event.errorMessage,
          status: 'failed',
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // System notification
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        subject: 'Payment Failed',
        message: `Your payment for ${event.licenseName} failed. Please try again.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          type: 'payment_failed',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send order failed notification: ${message}`, stack);
    }
  }

  @OnEvent(OrderEventType.ORDER_CANCELLED)
  async handleOrderCancelled(event: OrderCancelledEvent) {
    this.logger.log(`Handling order cancelled event for order: ${event.orderId}`);

    try {
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        recipient: event.buyerEmail,
        subject: `Order Cancelled - ${event.licenseName}`,
        message: `Your order for ${event.licenseName} has been cancelled.${event.reason ? ` Reason: ${event.reason}` : ''}`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          buyerName: event.buyerName,
          reason: event.reason,
          status: 'cancelled',
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send order cancelled notification: ${message}`, stack);
    }
  }

  @OnEvent(OrderEventType.ORDER_REFUNDED)
  async handleOrderRefunded(event: OrderRefundedEvent) {
    this.logger.log(`Handling order refunded event for order: ${event.orderId}`);

    try {
      // Notify buyer
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.ORDER,
        userId: event.buyerId,
        recipient: event.buyerEmail,
        subject: `Refund Processed - ${event.licenseName}`,
        message: `Your refund of ${event.currency} ${event.amount} for ${event.licenseName} has been processed.`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          amount: event.amount,
          currency: event.currency,
          buyerName: event.buyerName,
          status: 'refunded',
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Notify owner
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.SALE,
        userId: event.licenseOwnerId,
        subject: 'Order Refunded',
        message: `An order for ${event.licenseName} has been refunded (${event.currency} ${event.amount})`,
        data: {
          orderId: event.orderId,
          licenseName: event.licenseName,
          amount: event.amount,
          type: 'refund_processed',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send order refunded notification: ${message}`, stack);
    }
  }

  // ==================== DEPLOYMENT EVENTS ====================

  @OnEvent(DeploymentEventType.DEPLOYMENT_CREATED)
  async handleDeploymentCreated(event: DeploymentCreatedEvent) {
    this.logger.log(`Handling deployment created event for deployment: ${event.deploymentId}`);

    try {
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.DEPLOYMENT,
        userId: event.userId,
        subject: 'Deployment Started',
        message: `Your deployment has been created and is being processed.`,
        data: {
          deploymentId: event.deploymentId,
          projectId: event.deployment.project_id,
          environment: event.deployment.environment,
          type: 'deployment_started',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send deployment created notification: ${message}`, stack);
    }
  }

  @OnEvent(DeploymentEventType.DEPLOYMENT_COMPLETED)
  async handleDeploymentCompleted(event: DeploymentCompletedEvent) {
    this.logger.log(`Handling deployment completed event for deployment: ${event.deploymentId}`);

    try {
      // System notification
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.DEPLOYMENT,
        userId: event.userId,
        subject: 'Deployment Successful',
        message: `Your deployment has been completed successfully!${event.deploymentUrl ? ` View at: ${event.deploymentUrl}` : ''}`,
        data: {
          deploymentId: event.deploymentId,
          deploymentUrl: event.deploymentUrl,
          projectId: event.deployment.project_id,
          environment: event.deployment.environment,
          type: 'deployment_completed',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send deployment completed notification: ${message}`, stack);
    }
  }

  @OnEvent(DeploymentEventType.DEPLOYMENT_FAILED)
  async handleDeploymentFailed(event: DeploymentFailedEvent) {
    this.logger.log(`Handling deployment failed event for deployment: ${event.deploymentId}`);

    try {
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.DEPLOYMENT,
        userId: event.userId,
        subject: 'Deployment Failed',
        message: `Your deployment has failed. Error: ${event.errorMessage}`,
        data: {
          deploymentId: event.deploymentId,
          errorMessage: event.errorMessage,
          type: 'deployment_failed',
        },
      });
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`Failed to send deployment failed notification: ${message}`, stack);
    }
  }
}
