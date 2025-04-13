import { Injectable, Logger } from '@nestjs/common';

import {
  DeploymentConfig,
  DeploymentResult,
  GithubDeployerService,
} from './services/github-deployer.service';

/**
 * Controller for handling deployment requests
 */
@Injectable()
export class DeploymentController {
  private readonly logger = new Logger(DeploymentController.name);

  constructor(private readonly deployerService: GithubDeployerService) {}

  /**
   * Trigger deployment for a single user
   */
  deployForUser(config: DeploymentConfig): Promise<DeploymentResult> {
    this.logger.log(`Triggering deployment for user ${config.name} (${config.environment})`);
    return this.deployerService.triggerDeployment(config);
  }

  /**
   * Trigger deployments for multiple users
   */
  deployForUsers(configs: DeploymentConfig[]): Promise<DeploymentResult[]> {
    this.logger.log(`Triggering deployments for ${configs.length} users`);
    return this.deployerService.batchDeploy(configs);
  }

  /**
   * Check deployment status
   */
  checkStatus(result: DeploymentResult): Promise<DeploymentResult> {
    return this.deployerService.checkDeploymentStatus(result);
  }
}
