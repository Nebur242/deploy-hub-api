import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';

import { NotificationService } from './notification.service';
import { UserLicense } from '../../license/entities/user-license.entity';
import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * Service responsible for scheduling and sending license expiration notifications
 */
@Injectable()
export class LicenseExpirationSchedulerService {
  private readonly logger = new Logger(LicenseExpirationSchedulerService.name);
  private readonly userDashboardUrl: string;

  constructor(
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    this.userDashboardUrl =
      this.configService.get<string>('USER_DASHBOARD_URL') || 'https://app.deployhub.com';
  }

  /**
   * Run daily at 9:00 AM to check for expiring licenses
   * Sends warnings for licenses expiring in 7 days and 1 day
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleLicenseExpirationWarnings() {
    this.logger.log('Running license expiration check...');

    try {
      // Get licenses expiring in 7 days
      await this.sendExpirationWarnings(7);

      // Get licenses expiring in 1 day
      await this.sendExpirationWarnings(1);

      this.logger.log('License expiration check completed');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to run license expiration check: ${error.message}`, error.stack);
    }
  }

  /**
   * Send expiration warnings for licenses expiring in the specified number of days
   */
  private async sendExpirationWarnings(daysUntilExpiration: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find licenses expiring on the target date
    const expiringLicenses = await this.userLicenseRepository.find({
      where: {
        active: true,
        expires_at: Between(targetDate, nextDay),
      },
      relations: ['owner', 'license', 'license.projects'],
    });

    this.logger.log(
      `Found ${expiringLicenses.length} licenses expiring in ${daysUntilExpiration} day(s)`,
    );

    for (const userLicense of expiringLicenses) {
      await this.sendExpirationWarningNotification(userLicense, daysUntilExpiration);
    }
  }

  /**
   * Send an expiration warning notification for a specific user license
   */
  private async sendExpirationWarningNotification(
    userLicense: UserLicense,
    daysUntilExpiration: number,
  ) {
    if (!userLicense.owner || !userLicense.license) {
      this.logger.warn(
        `Skipping notification for user license ${userLicense.id}: missing owner or license data`,
      );
      return;
    }

    const ownerName =
      `${userLicense.owner.first_name || ''} ${userLicense.owner.last_name || ''}`.trim() || 'User';
    const ownerEmail = userLicense.owner.email;
    const licenseName = userLicense.license.name || 'your license';
    const projectName = userLicense.license.projects?.[0]?.name || 'your project';

    const subject =
      daysUntilExpiration === 1
        ? `⚠️ License Expires Tomorrow - ${licenseName}`
        : `License Expiring Soon - ${licenseName}`;

    const message =
      daysUntilExpiration === 1
        ? `Your license for ${licenseName} (${projectName}) expires tomorrow! Renew now to keep access to your deployment features.`
        : `Your license for ${licenseName} (${projectName}) will expire in ${daysUntilExpiration} days. Consider renewing to maintain uninterrupted access.`;

    try {
      // Send email notification
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.LICENCES,
        userId: userLicense.owner.id,
        recipient: ownerEmail,
        subject,
        message,
        data: {
          userName: ownerName,
          licenseName,
          projectName,
          expiresAt: userLicense.expires_at?.toISOString(),
          daysUntilExpiration,
          renewUrl: `${this.userDashboardUrl}/licenses/${userLicense.id}/renew`,
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Send system notification
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.LICENCES,
        userId: userLicense.owner.id,
        subject,
        message,
        data: {
          userLicenseId: userLicense.id,
          licenseName,
          projectName,
          daysUntilExpiration,
          type: 'license_expiring',
        },
      });

      this.logger.log(`Sent expiration warning to ${ownerEmail} for license ${userLicense.id}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to send expiration warning for license ${userLicense.id}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Run daily at midnight to deactivate expired licenses
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredLicenses() {
    this.logger.log('Running expired licenses deactivation...');

    try {
      const now = new Date();

      // Find and deactivate expired licenses
      const expiredLicenses = await this.userLicenseRepository.find({
        where: {
          active: true,
          expires_at: LessThan(now),
        },
        relations: ['owner', 'license', 'license.projects'],
      });

      this.logger.log(`Found ${expiredLicenses.length} expired licenses to deactivate`);

      for (const userLicense of expiredLicenses) {
        // Deactivate the license
        userLicense.active = false;
        await this.userLicenseRepository.save(userLicense);

        // Send expiration notification
        await this.sendExpiredNotification(userLicense);
      }

      this.logger.log('Expired licenses deactivation completed');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to deactivate expired licenses: ${error.message}`, error.stack);
    }
  }

  /**
   * Send notification when a license has expired
   */
  private async sendExpiredNotification(userLicense: UserLicense) {
    if (!userLicense.owner || !userLicense.license) {
      return;
    }

    const ownerName =
      `${userLicense.owner.first_name || ''} ${userLicense.owner.last_name || ''}`.trim() || 'User';
    const ownerEmail = userLicense.owner.email;
    const licenseName = userLicense.license.name || 'your license';
    const projectName = userLicense.license.projects?.[0]?.name || 'your project';

    try {
      // Send email notification
      await this.notificationService.create({
        type: NotificationType.EMAIL,
        scope: NotificationScope.LICENCES,
        userId: userLicense.owner.id,
        recipient: ownerEmail,
        subject: `License Expired - ${licenseName}`,
        message: `Your license for ${licenseName} (${projectName}) has expired. Renew now to restore access to your deployment features.`,
        data: {
          userName: ownerName,
          licenseName,
          projectName,
          expiredAt: userLicense.expires_at?.toISOString(),
          renewUrl: `${this.userDashboardUrl}/licenses/${userLicense.id}/renew`,
          dashboardUrl: this.userDashboardUrl,
          year: new Date().getFullYear(),
        },
      });

      // Send system notification
      await this.notificationService.create({
        type: NotificationType.SYSTEM,
        scope: NotificationScope.LICENCES,
        userId: userLicense.owner.id,
        subject: 'License Expired',
        message: `Your license for ${licenseName} has expired.`,
        data: {
          userLicenseId: userLicense.id,
          licenseName,
          projectName,
          type: 'license_expired',
        },
      });

      this.logger.log(
        `Sent expiration notification to ${ownerEmail} for license ${userLicense.id}`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to send expiration notification for license ${userLicense.id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
