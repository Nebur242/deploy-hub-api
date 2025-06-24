import { NOTIFICATION_QUEUE } from '@app/modules/queue/constants/notification-queue.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';

import { NotificationEntity } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';
import { EmailService } from '../providers/email.service';
import { FirebasePushService } from '../providers/firebase-push.service';
import { SmsService } from '../providers/sms.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { UserTokenRepository } from '../repositories/user-token.repository';

@Injectable()
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly firebasePushService: FirebasePushService,
    private readonly userTokenRepository: UserTokenRepository,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>, token?: string): Promise<unknown> {
    this.logger.debug(
      `Processing notification job ${job.id} for notification: ${job.data.notificationId} - token: ${token}`,
    );

    try {
      // Find the notification
      const notification = await this.notificationRepository.findOne({
        where: { id: job.data.notificationId },
        relations: ['user'],
      });

      if (!notification) {
        throw new NotFoundException(`Notification with ID ${job.data.notificationId} not found`);
      }

      // Process the notification based on its type
      let result;
      notification.status = 'processing';
      await this.notificationRepository.save(notification);

      switch (notification.type) {
        case NotificationType.EMAIL:
          result = await this.processEmailNotification(notification);
          break;
        case NotificationType.SMS:
          result = await this.processSmsNotification(notification);
          break;
        case NotificationType.SYSTEM:
        default:
          result = await this.processSystemNotification(notification);
      }

      // Update notification status
      notification.processedAt = new Date();
      notification.status = 'delivered';
      await this.notificationRepository.save(notification);

      // Log successful job completion
      this.logger.log(
        `Notification job ${job.id} completed successfully. Type: ${notification.type}, Recipient: ${
          notification.recipient || notification.userId
        }, Status: delivered`,
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      this.logger.error(`Error processing notification: ${error.message}`, error.stack);

      // Update notification with error
      try {
        await this.notificationRepository.update(job.data.notificationId, {
          status: 'failed',
          error: error.message,
          processedAt: new Date(),
        });
      } catch (err) {
        const updateError =
          err instanceof Error
            ? err
            : new Error('Unknown error occurred while updating notification');
        this.logger.error(`Error updating failed notification: ${updateError.message}`);
      }

      throw error;
    }
  }

  private processEmailNotification(notification: NotificationEntity) {
    this.logger.debug(`Processing email notification to: ${notification.recipient}`);

    if (!notification.recipient) {
      throw new Error('Email recipient is required for email notifications');
    }

    // Send email using email service
    return this.emailService.sendEmail({
      to: notification.recipient,
      subject: notification.subject || 'Notification',
      template: notification.template,
      templateData: notification.data || {},
      text: notification.message,
    });
  }

  private processSmsNotification(notification: NotificationEntity) {
    this.logger.debug(`Processing SMS notification to: ${notification.recipient}`);

    if (!notification.recipient) {
      throw new Error('Phone number is required for SMS notifications');
    }

    // Send SMS using SMS service
    return this.smsService.sendSms({
      to: notification.recipient,
      message: notification.message,
    });
  }

  private async processSystemNotification(notification: NotificationEntity) {
    this.logger.debug(`Processing system notification for user: ${notification.userId}`);

    if (!notification.userId) {
      throw new Error('User ID is required for system notifications');
    }

    // Get user tokens from the UserTokenEntity
    const userToken = await this.userTokenRepository.getUserToken(notification.userId);

    if (!userToken || !userToken.tokens || userToken.tokens.length === 0) {
      this.logger.warn(`No Firebase tokens found for user ${notification.userId}`);
      return { success: false, message: 'No Firebase tokens found for user' };
    }

    // Send push notification to all user tokens
    return this.firebasePushService.sendMulticastPushNotification(userToken.tokens, {
      title: notification.subject || 'System Notification',
      body: notification.message,
      data: notification.data
        ? // Convert all values to strings as required by Firebase
          Object.entries(notification.data).reduce(
            (acc, [key, value]) => {
              acc[key] = String(value);
              return acc;
            },
            {} as Record<string, string>,
          )
        : undefined,
    });
  }
}
