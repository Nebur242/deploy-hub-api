import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeploymentService } from '../deployment.service';
import { Deployment, DeploymentStatus } from '../entities/deployment.entity';

@Injectable()
export class DeploymentTrackerService {
  private readonly logger = new Logger(DeploymentTrackerService.name);
  private readonly batchSize: number;
  private readonly maxAge: number; // in milliseconds

  constructor(
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    private readonly deploymentService: DeploymentService,
    private readonly configService: ConfigService,
  ) {
    // Get configuration with defaults
    this.batchSize = this.configService.get<number>('DEPLOYMENT_TRACKER_BATCH_SIZE', 10);

    // Default to 1 hour maximum age
    const maxAgeHours = this.configService.get<number>('DEPLOYMENT_MAX_RUNNING_HOURS', 1);
    this.maxAge = maxAgeHours * 60 * 60 * 1000;
  }

  /**
   * Runs every 2 minutes to check the status of all running deployments
   * and updates their status based on GitHub workflow status
   */
  @Cron('*/2 * * * *')
  async trackDeploymentStatuses() {
    try {
      this.logger.log('Running scheduled deployment status check');

      // Calculate cutoff time for stale deployments
      const cutoffTime = new Date(Date.now() - this.maxAge);

      // Find running deployments, prioritizing newer ones first, with a batch limit
      const runningDeployments = await this.deploymentRepository.find({
        where: { status: DeploymentStatus.RUNNING },
        order: { updated_at: 'DESC' },
        take: this.batchSize,
      });

      if (runningDeployments.length === 0) {
        this.logger.debug('No running deployments to check');
        return;
      }

      this.logger.log(`Processing batch of ${runningDeployments.length} running deployment(s)`);

      // Process deployments in parallel with rate limiting
      const results = await Promise.all(
        runningDeployments.map(async deployment => {
          try {
            // Mark very old deployments as failed
            if (deployment.updated_at < cutoffTime) {
              this.logger.warn(
                `Deployment ${deployment.id} has been running for too long, marking as failed`,
              );
              deployment.status = DeploymentStatus.FAILED;
              deployment.error_message =
                'Deployment timed out after exceeding maximum running time';
              return this.deploymentRepository.save(deployment);
            }

            // Standard status update
            return await this.deploymentService.updateDeploymentStatus(deployment.id);
          } catch (err) {
            const error = err as Error;
            this.logger.error(`Error updating deployment ${deployment.id}: ${error.message}`);
            return deployment;
          }
        }),
      );

      const updatedCount = results.filter(d => d.status !== DeploymentStatus.RUNNING).length;

      this.logger.log(`Status check completed. Updated ${updatedCount} deployment(s)`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error in deployment status batch update: ${error.message}`, error.stack);
    }
  }
}
