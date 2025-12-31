import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserLicenseService } from '../../license/services/user-license.service';
import {
  DeploymentEventType,
  DeploymentCompletedEvent,
  DeploymentFailedEvent,
  DeploymentLimitReachedEvent,
  DeploymentStartedEvent,
} from '../events/deployment.events';

@Injectable()
export class DeploymentEventListener {
  private readonly logger = new Logger(DeploymentEventListener.name);

  constructor(private readonly userLicenseService: UserLicenseService) {}

  /**
   * Handle deployment started event
   * Log the deployment start for monitoring
   */
  @OnEvent(DeploymentEventType.DEPLOYMENT_STARTED)
  handleDeploymentStarted(event: DeploymentStartedEvent): void {
    this.logger.log(
      `Deployment ${event.deploymentId} started with workflow ${event.workflowRunId} using account ${event.githubUsername}`,
    );
  }

  /**
   * Handle deployment completed event
   * Update user license counts for non-owner deployments
   */
  @OnEvent(DeploymentEventType.DEPLOYMENT_COMPLETED)
  async handleDeploymentCompleted(event: DeploymentCompletedEvent): Promise<void> {
    this.logger.log(
      `Deployment ${event.deploymentId} completed successfully. URL: ${event.deploymentUrl || 'N/A'}`,
    );

    // Only increment user license count for non-owners
    // Owner deployments are tracked via subscription
    if (!event.isProjectOwner && event.deployment.user_license_id) {
      try {
        // Update user license deployment count
        await this.updateUserLicenseCount(event);
        this.logger.log(`Updated user license count for deployment ${event.deploymentId}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          `Failed to update user license count for deployment ${event.deploymentId}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Handle deployment failed event
   * Log the failure for monitoring and alerting
   */
  @OnEvent(DeploymentEventType.DEPLOYMENT_FAILED)
  handleDeploymentFailed(event: DeploymentFailedEvent): void {
    this.logger.error(
      `Deployment ${event.deploymentId} failed for user ${event.userId}: ${event.errorMessage}`,
    );
    // Future: Add notification service integration here
    // await this.notificationService.sendDeploymentFailedNotification(event);
  }

  /**
   * Handle deployment limit reached event
   * Log and potentially notify users
   */
  @OnEvent(DeploymentEventType.DEPLOYMENT_LIMIT_REACHED)
  handleDeploymentLimitReached(event: DeploymentLimitReachedEvent): void {
    this.logger.warn(
      `Deployment limit reached for user ${event.userId}. Type: ${event.limitType}, Count: ${event.currentCount}/${event.maxAllowed}`,
    );
    // Future: Add notification service integration here
    // await this.notificationService.sendLimitReachedNotification(event);
  }

  /**
   * Update user license deployment count
   */
  private async updateUserLicenseCount(event: DeploymentCompletedEvent): Promise<void> {
    const { deployment } = event;

    if (!deployment.user_license_id) {
      return;
    }

    try {
      await this.userLicenseService.incrementDeploymentCount(
        deployment.user_license_id,
        deployment.id,
      );
      this.logger.log(
        `Incremented deployment count for user license ${deployment.user_license_id}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error updating user license count: ${err.message}`);
    }
  }
}
