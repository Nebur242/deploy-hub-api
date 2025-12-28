import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

import { DeploymentService } from '../deployment.service';
import { Deployment, DeploymentStatus } from '../entities/deployment.entity';
import {
  DeploymentEventType,
  DeploymentFailedEvent,
  DeploymentTimeoutEvent,
} from '../events/deployment.events';
import { DeploymentRepository } from '../repositories/deployment.repository';
import { DeploymentConcurrencyService } from '../services/deployment-concurrency.service';
import { GithubWebhookService } from '../services/github-webhook.service';

/**
 * Statistics for a timeout check run
 */
interface TimeoutCheckStats {
  totalChecked: number;
  timedOut: number;
  statusUpdated: number;
  errors: number;
}

/**
 * Configuration for the deployment tracker
 */
interface TrackerConfig {
  /** Batch size for processing deployments */
  batchSize: number;
  /** Maximum age for running deployments (milliseconds) */
  maxRunningAgeMs: number;
  /** Maximum age for pending deployments (milliseconds) */
  maxPendingAgeMs: number;
  /** Whether to clean up webhooks for timed-out deployments */
  cleanupWebhooks: boolean;
  /** Enable stale deployment cleanup */
  enableStaleCleanup: boolean;
}

@Injectable()
export class DeploymentTrackerService {
  private readonly logger = new Logger(DeploymentTrackerService.name);
  private readonly config: TrackerConfig;

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly deploymentService: DeploymentService,
    private readonly webhookService: GithubWebhookService,
    private readonly concurrencyService: DeploymentConcurrencyService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    // Load configuration with sensible defaults
    this.config = this.loadConfiguration();
    this.logger.log(`DeploymentTracker initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): TrackerConfig {
    const maxRunningHours = this.configService.get<number>('DEPLOYMENT_MAX_RUNNING_HOURS', 1);
    const maxPendingMinutes = this.configService.get<number>('DEPLOYMENT_MAX_PENDING_MINUTES', 15);

    return {
      batchSize: this.configService.get<number>('DEPLOYMENT_TRACKER_BATCH_SIZE', 10),
      maxRunningAgeMs: maxRunningHours * 60 * 60 * 1000,
      maxPendingAgeMs: maxPendingMinutes * 60 * 1000,
      cleanupWebhooks: this.configService.get<boolean>('DEPLOYMENT_CLEANUP_WEBHOOKS', true),
      enableStaleCleanup: this.configService.get<boolean>('DEPLOYMENT_STALE_CLEANUP_ENABLED', true),
    };
  }

  /**
   * Runs every 2 minutes to check the status of all running deployments
   * and updates their status based on GitHub workflow status
   */
  @Cron('*/2 * * * *')
  async trackDeploymentStatuses(): Promise<TimeoutCheckStats> {
    const stats: TimeoutCheckStats = {
      totalChecked: 0,
      timedOut: 0,
      statusUpdated: 0,
      errors: 0,
    };

    try {
      this.logger.log('Running scheduled deployment status check');

      // Find running deployments, prioritizing newer ones first, with a batch limit
      const runningDeployments = await this.deploymentRepository.findByStatus(
        DeploymentStatus.RUNNING,
      );

      // Apply batch limit
      const deploymentsToProcess = runningDeployments.slice(0, this.config.batchSize);

      if (deploymentsToProcess.length === 0) {
        this.logger.debug('No running deployments to check');
        return stats;
      }

      this.logger.log(`Processing batch of ${deploymentsToProcess.length} running deployment(s)`);
      stats.totalChecked = deploymentsToProcess.length;

      // Process deployments sequentially to avoid rate limiting
      for (const deployment of deploymentsToProcess) {
        try {
          const result = await this.processDeployment(deployment);

          if (result.timedOut) {
            stats.timedOut++;
          } else if (result.statusChanged) {
            stats.statusUpdated++;
          }
        } catch (err) {
          const error = err as Error;
          this.logger.error(`Error processing deployment ${deployment.id}: ${error.message}`);
          stats.errors++;
        }
      }

      this.logger.log(
        `Status check completed. Checked: ${stats.totalChecked}, ` +
          `Timed out: ${stats.timedOut}, Updated: ${stats.statusUpdated}, Errors: ${stats.errors}`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error in deployment status batch update: ${error.message}`, error.stack);
    }

    return stats;
  }

  /**
   * Process a single deployment - check for timeout or update status
   */
  private async processDeployment(
    deployment: Deployment,
  ): Promise<{ timedOut: boolean; statusChanged: boolean }> {
    const now = Date.now();
    const deploymentAge = now - deployment.updated_at.getTime();

    // Check if deployment has timed out
    if (deploymentAge > this.config.maxRunningAgeMs) {
      this.logger.warn(
        `Deployment ${deployment.id} has been running for ${Math.round(deploymentAge / 60000)} minutes, marking as timed out`,
      );

      await this.handleTimeout(deployment, 'running');
      return { timedOut: true, statusChanged: true };
    }

    // Standard status update via GitHub API
    try {
      const updatedDeployment = await this.deploymentService.updateDeploymentStatus(deployment.id);
      const statusChanged = updatedDeployment.status !== DeploymentStatus.RUNNING;

      if (statusChanged) {
        // Release any concurrency locks
        this.concurrencyService.releaseLockByDeploymentId(deployment.id);
      }

      return { timedOut: false, statusChanged };
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to update status for deployment ${deployment.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle a timed-out deployment
   */
  private async handleTimeout(
    deployment: Deployment,
    type: 'running' | 'pending',
  ): Promise<Deployment> {
    const timeoutMessage =
      type === 'running'
        ? `Deployment timed out after exceeding maximum running time (${Math.round(this.config.maxRunningAgeMs / 60000)} minutes)`
        : `Deployment timed out while pending (${Math.round(this.config.maxPendingAgeMs / 60000)} minutes)`;

    // Mark deployment as failed
    const updatedDeployment = await this.deploymentRepository.markAsFailed(
      deployment.id,
      timeoutMessage,
    );

    // Release concurrency lock
    this.concurrencyService.releaseLockByDeploymentId(deployment.id);

    // Clean up webhook if exists
    if (this.config.cleanupWebhooks && deployment.webhook_info) {
      await this.cleanupDeploymentWebhook(deployment);
    }

    // Emit timeout event
    this.eventEmitter.emit(
      DeploymentEventType.DEPLOYMENT_TIMEOUT,
      new DeploymentTimeoutEvent(deployment.id, type, timeoutMessage, deployment.owner_id),
    );

    // Also emit failed event for notification purposes
    this.eventEmitter.emit(
      DeploymentEventType.DEPLOYMENT_FAILED,
      new DeploymentFailedEvent(deployment.id, timeoutMessage, deployment.owner_id),
    );

    return updatedDeployment;
  }

  /**
   * Clean up webhook for a deployment
   */
  private async cleanupDeploymentWebhook(deployment: Deployment): Promise<void> {
    if (!deployment.webhook_info) {
      return;
    }

    try {
      const { hookId, repositoryOwner, repositoryName } = deployment.webhook_info;

      // Get the access token from the deployment's GitHub account
      if (deployment.github_account?.access_token) {
        await this.webhookService.deleteDeploymentWebhook(
          repositoryOwner,
          repositoryName,
          deployment.github_account.access_token,
          hookId,
        );

        this.logger.log(`Cleaned up webhook ${hookId} for timed-out deployment ${deployment.id}`);

        // Clear webhook info from deployment
        await this.deploymentRepository.clearWebhookInfo(deployment.id);
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to clean up webhook for deployment ${deployment.id}: ${error.message}`,
      );
      // Don't throw - webhook cleanup is best-effort
    }
  }

  /**
   * Runs every 5 minutes to clean up stale pending deployments
   */
  @Cron('*/5 * * * *')
  async cleanupStalePendingDeployments(): Promise<number> {
    if (!this.config.enableStaleCleanup) {
      return 0;
    }

    try {
      this.logger.log('Running stale pending deployment cleanup');

      const cutoffTime = new Date(Date.now() - this.config.maxPendingAgeMs);

      // Find pending deployments that are too old
      const stalePending = await this.deploymentRepository.findBy({
        status: DeploymentStatus.PENDING,
      });

      const deploymentsToClean = stalePending.filter(d => d.created_at < cutoffTime);

      if (deploymentsToClean.length === 0) {
        this.logger.debug('No stale pending deployments to clean up');
        return 0;
      }

      this.logger.log(`Found ${deploymentsToClean.length} stale pending deployment(s)`);

      for (const deployment of deploymentsToClean) {
        await this.handleTimeout(deployment, 'pending');
      }

      this.logger.log(`Cleaned up ${deploymentsToClean.length} stale pending deployment(s)`);
      return deploymentsToClean.length;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error cleaning up stale pending deployments: ${error.message}`);
      return 0;
    }
  }

  /**
   * Force timeout a specific deployment (for manual intervention)
   */
  async forceTimeoutDeployment(deploymentId: string, reason?: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findByIdOrFail(deploymentId);

    if (
      deployment.status !== DeploymentStatus.RUNNING &&
      deployment.status !== DeploymentStatus.PENDING
    ) {
      throw new Error(`Deployment ${deploymentId} is not in a state that can be timed out`);
    }

    const timeoutMessage = reason || 'Deployment manually timed out by administrator';

    const updatedDeployment = await this.deploymentRepository.markAsFailed(
      deploymentId,
      timeoutMessage,
    );

    // Release concurrency lock
    this.concurrencyService.releaseLockByDeploymentId(deploymentId);

    // Clean up webhook
    if (this.config.cleanupWebhooks && deployment.webhook_info) {
      await this.cleanupDeploymentWebhook(deployment);
    }

    this.eventEmitter.emit(
      DeploymentEventType.DEPLOYMENT_TIMEOUT,
      new DeploymentTimeoutEvent(deploymentId, 'manual', timeoutMessage, deployment.owner_id),
    );

    return updatedDeployment;
  }

  /**
   * Get current tracker statistics
   */
  async getStats(): Promise<{
    runningCount: number;
    pendingCount: number;
    activeLocks: number;
  }> {
    const [runningCount, pendingCount] = await Promise.all([
      this.deploymentRepository.countByStatus(DeploymentStatus.RUNNING),
      this.deploymentRepository.countByStatus(DeploymentStatus.PENDING),
    ]);

    return {
      runningCount,
      pendingCount,
      activeLocks: this.concurrencyService.getActiveLockCount(),
    };
  }
}
