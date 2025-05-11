import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushNotificationOptions {
  token: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Service for sending Firebase push notifications
 */
@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);

  /**
   * Send a push notification to a specific device token
   * @param options Push notification options
   * @returns Result of sending the push notification
   */
  async sendPushNotification(options: PushNotificationOptions) {
    this.logger.debug(`Sending push notification to token: ${options.token}`);

    try {
      const message = {
        token: options.token,
        notification: {
          title: options.title,
          body: options.body,
          ...(options.imageUrl && { imageUrl: options.imageUrl }),
        },
        ...(options.data && { data: options.data }),
      };

      const response = await getMessaging().send(message);

      this.logger.log(`Push notification sent successfully: ${response}`);
      return {
        success: true,
        messageId: response,
        token: options.token,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);

      // Don't throw the error as this could prevent other tokens from being processed
      return {
        success: false,
        error: error.message,
        token: options.token,
      };
    }
  }

  /**
   * Send push notifications to multiple device tokens
   * @param tokens Array of device tokens to send to
   * @param options Push notification options (without token)
   * @returns Array of results for each token
   */
  async sendMulticastPushNotification(
    tokens: string[],
    options: Omit<PushNotificationOptions, 'token'>,
  ) {
    this.logger.debug(`Sending multicast push notification to ${tokens.length} tokens`);

    if (tokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, results: [] };
    }

    try {
      const message = {
        notification: {
          title: options.title,
          body: options.body,
          ...(options.imageUrl && { imageUrl: options.imageUrl }),
        },
        ...(options.data && { data: options.data }),
        tokens,
      };

      const response = await getMessaging().sendEachForMulticast(message);

      console.log(response.responses);

      this.logger.log(
        `Multicast push notification sent: ${response.successCount} successful, ${response.failureCount} failed`,
      );

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        results: response.responses,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to send multicast push notification: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        successCount: 0,
        failureCount: tokens.length,
        error: error.message,
      };
    }
  }
}
