import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { ServiceCreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { GitHubAccount } from './dto/github-account.dto';
import { Deployment, DeploymentStatus } from './entities/deployment.entity';
import { GithubDeployerService } from './services/github-deployer.service';
import { ProjectConfiguration } from '../projects/entities/project-configuration.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    private encryptionService: EncryptionService,
    private readonly deployerService: GithubDeployerService,
    @InjectRepository(ProjectConfiguration)
    private projectConfigurationRepository: Repository<ProjectConfiguration>,
  ) {}

  /**
   * Create a new deployment using project GitHub accounts
   */
  async createDeployment(
    serviceCreateDeploymentDto: ServiceCreateDeploymentDto,
    project: Project,
    configuration: ProjectConfiguration,
  ): Promise<Deployment> {
    // Create deployment record
    const deployment = this.deploymentRepository.create({
      projectId: serviceCreateDeploymentDto.projectId,
      configurationId: serviceCreateDeploymentDto.configurationId,
      configuration,
      project,
      ownerId: serviceCreateDeploymentDto.ownerId,
      environment: serviceCreateDeploymentDto.environment,
      branch: serviceCreateDeploymentDto.branch,
      status: 'pending',
      environmentVariables: serviceCreateDeploymentDto.environmentVariables,
    });

    await this.deploymentRepository.save(deployment);

    // Get recent deployments for this project to determine next account in rotation
    const recentDeployments = await this.deploymentRepository.find({
      where: { projectId: serviceCreateDeploymentDto.projectId },
      order: { createdAt: 'DESC' },
      take: configuration.githubAccounts.length > 0 ? configuration.githubAccounts.length : 1,
    });

    // Decrypt GitHub account tokens
    const githubAccounts = configuration.githubAccounts.map(account => ({
      ...account,
      //   accessToken: this.encryptionService.decrypt(account.accessToken),
      available: true,
      failureCount: 0,
      lastUsed: new Date(),
    }));

    if (githubAccounts.length === 0) {
      throw new Error('No GitHub accounts available for deployment');
    }

    // Start deployment process asynchronously with ordered accounts
    try {
      const orderedAccounts = this.getOrderedAccounts(githubAccounts, recentDeployments);
      await this.triggerDeployment(
        deployment,
        configuration,
        serviceCreateDeploymentDto,
        orderedAccounts,
      );
      this.logger.log(`Deployment ${deployment.id} started successfully`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Deployment ${deployment.id} failed: ${error.message}`);
      deployment.status = DeploymentStatus.FAILED;
      deployment.errorMessage = error.message;
      await this.deploymentRepository.save(deployment);
    }

    return deployment;
  }

  /**
   * Order GitHub accounts for round-robin deployment
   */
  private getOrderedAccounts(
    githubAccounts: GitHubAccount[],
    recentDeployments: Deployment[],
  ): GitHubAccount[] {
    // If there's only one account or no recent deployments, just return the accounts
    if (githubAccounts.length <= 1 || recentDeployments.length === 0) {
      return [...githubAccounts];
    }

    // Find the last used account
    let startIndex = 0;
    if (recentDeployments[0].githubAccount) {
      const lastUsername = recentDeployments[0].githubAccount.username;
      const lastIndex = githubAccounts.findIndex(a => a.username === lastUsername);
      if (lastIndex !== -1) {
        // Start with the next account in the sequence
        startIndex = (lastIndex + 1) % githubAccounts.length;
      }
    }

    // Reorder accounts to start with the next one in sequence (round-robin)
    return [...githubAccounts.slice(startIndex), ...githubAccounts.slice(0, startIndex)];
  }

  private async triggerDeployment(
    deployment: Deployment,
    configuration: ProjectConfiguration,
    deploymentConfig: ServiceCreateDeploymentDto,
    orderedAccounts: GitHubAccount[],
  ): Promise<void> {
    // Ensure we have accounts to try
    if (orderedAccounts.length === 0) {
      throw new Error('No GitHub accounts available for deployment');
    }

    // Only use the first account in the ordered list
    const account = orderedAccounts[0];

    try {
      const githubAccount = {
        ...account,
        available: true,
        failureCount: 0,
        lastUsed: new Date(),
      };

      const result = await this.deployerService.deployToGitHub(
        deployment,
        githubAccount,
        deploymentConfig,
      );

      // Success - update deployment with result
      deployment.githubAccount = {
        ...githubAccount,
        accessToken: this.encryptionService.encrypt(githubAccount.accessToken),
      };
      deployment.workflowRunId = `${result.workflowRunId}`;
      deployment.status = DeploymentStatus.RUNNING;
      await this.deploymentRepository.save(deployment);

      // Successfully deployed, return
      return;
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Deployment with account ${account.username} failed: ${error.message}`);

      // Mark as failed since we're not trying multiple accounts
      deployment.status = DeploymentStatus.FAILED;
      deployment.errorMessage = error.message;
      await this.deploymentRepository.save(deployment);
      throw error;
    }
  }

  /**
   * Retry a failed deployment
   */
  async retryDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findOne({ where: { id: deploymentId } });

    if (!deployment) {
      throw new Error(`Deployment with ID "${deploymentId}" not found`);
    }

    if (deployment.status !== DeploymentStatus.FAILED) {
      throw new Error('Only failed deployments can be retried');
    }

    // Reset deployment status for retry
    deployment.status = DeploymentStatus.PENDING;
    deployment.errorMessage = '';

    await this.deploymentRepository.save(deployment);

    // Find project and configuration
    // await this.projectService.findOne(deployment.projectId);
    const configuration = await this.projectConfigurationRepository.findOne({
      where: { id: deployment.configurationId },
    });

    if (!configuration) {
      throw new Error(`Configuration with ID "${deployment.configurationId}" not found`);
    }
    // Get all GitHub accounts for the project
    const githubAccounts = configuration.githubAccounts.map(account => ({
      ...account,
      accessToken: this.encryptionService.decrypt(account.accessToken),
      available: true,
      failureCount: 0,
      lastUsed: new Date(),
    }));

    // Get recent deployments to determine order
    const recentDeployments = await this.deploymentRepository.find({
      where: { projectId: deployment.projectId },
      order: { createdAt: 'DESC' },
      take: configuration.githubAccounts.length > 0 ? configuration.githubAccounts.length : 1,
    });

    // Exclude the last failed account if possible
    const orderedAccounts = this.getOrderedAccountsForRetry(
      githubAccounts,
      recentDeployments,
      deployment.githubAccount?.username,
    );

    // Create deployment config from stored deployment
    const deploymentConfig: ServiceCreateDeploymentDto = {
      projectId: deployment.projectId,
      configurationId: configuration.id,
      environment: deployment.environment,
      branch: deployment.branch,
      environmentVariables: deployment.environmentVariables,
      ownerId: deployment.ownerId,
    };

    // Trigger deployment with reordered accounts
    try {
      await this.triggerDeployment(deployment, configuration, deploymentConfig, orderedAccounts);
      this.logger.log(`Deployment ${deployment.id} retry started successfully`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Deployment ${deployment.id} retry failed: ${error.message}`);
      deployment.status = DeploymentStatus.FAILED;
      deployment.errorMessage = error.message;
      await this.deploymentRepository.save(deployment);
    }

    return deployment;
  }

  /**
   * Order GitHub accounts for retry, prioritizing accounts that haven't failed
   */
  private getOrderedAccountsForRetry(
    githubAccounts: GitHubAccount[],
    recentDeployments: Deployment[],
    lastFailedUsername?: string,
  ): GitHubAccount[] {
    // If we don't have a last failed account or only one account, return default order
    if (!lastFailedUsername || githubAccounts.length <= 1) {
      return this.getOrderedAccounts(githubAccounts, recentDeployments);
    }

    // Find the failed account index
    const failedIndex = githubAccounts.findIndex(a => a.username === lastFailedUsername);
    if (failedIndex === -1) {
      return this.getOrderedAccounts(githubAccounts, recentDeployments);
    }

    // Start with the next account after the failed one
    const startIndex = (failedIndex + 1) % githubAccounts.length;

    // Return accounts starting from the next one after the failed one
    return [...githubAccounts.slice(startIndex), ...githubAccounts.slice(0, startIndex)];
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
      relations: ['project', 'configuration'],
    });

    if (!deployment) {
      throw new Error(`Deployment with ID "${deploymentId}" not found`);
    }

    return deployment;
  }

  /**
   * Get all deployments for a project
   */
  getProjectDeployments(projectId: string): Promise<Deployment[]> {
    return this.deploymentRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get paginated deployments with filters
   */
  getDeployments(
    filterDto: FilterDeploymentDto,
    options: IPaginationOptions,
  ): Promise<Pagination<Deployment>> {
    const queryBuilder = this.deploymentRepository.createQueryBuilder('deployment');

    // Always filter by project

    if (filterDto.projectId) {
      queryBuilder.where('deployment.projectId = :projectId', {
        projectId: filterDto.projectId,
      });
    }

    // Apply optional filters
    if (filterDto.ownerId) {
      queryBuilder.andWhere('deployment.ownerId = :ownerId', {
        ownerId: filterDto.ownerId,
      });
    }

    if (filterDto.environment) {
      queryBuilder.andWhere('deployment.environment = :environment', {
        environment: filterDto.environment,
      });
    }

    if (filterDto.status) {
      queryBuilder.andWhere('deployment.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.branch) {
      queryBuilder.andWhere('deployment.branch = :branch', {
        branch: filterDto.branch,
      });
    }

    // Always order by createdAt DESC (newest first)
    queryBuilder.orderBy('deployment.createdAt', 'DESC');

    // add project relation
    queryBuilder.leftJoinAndSelect('deployment.project', 'project');
    queryBuilder.leftJoinAndSelect('deployment.configuration', 'configuration');

    return paginate<Deployment>(queryBuilder, options);
  }
  /**
   * Get logs for a deployment
   */
  async getDeploymentLogs(deploymentId: string): Promise<{ logs: string }> {
    const deployment = await this.getDeployment(deploymentId);

    if (!deployment.githubAccount || !deployment.workflowRunId) {
      return { logs: 'No workflow information available for this deployment' };
    }

    try {
      const logs = await this.deployerService.getWorkflowLogs(
        {
          username: deployment.githubAccount.username,
          accessToken: this.encryptionService.decrypt(deployment.githubAccount.accessToken),
          repository: deployment.githubAccount.repository,
        },
        parseInt(deployment.workflowRunId, 10),
      );

      return { logs };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error fetching logs for deployment ${deploymentId}: ${error.message}`);
      return { logs: `Error fetching logs: ${error.message}` };
    }
  }

  /**
   * Update deployment status from GitHub workflow
   * This should be called periodically or webhook-triggered
   */
  async updateDeploymentStatus(deploymentId: string): Promise<Deployment> {
    const deployment = await this.getDeployment(deploymentId);

    // Only check running deployments
    if (
      deployment.status !== DeploymentStatus.RUNNING ||
      !deployment.githubAccount ||
      !deployment.workflowRunId
    ) {
      return deployment;
    }

    try {
      // Check workflow status
      const status = await this.deployerService.checkWorkflowStatus(
        {
          username: deployment.githubAccount.username,
          accessToken: this.encryptionService.decrypt(deployment.githubAccount.accessToken),
          repository: deployment.githubAccount.repository,
        },

        parseInt(deployment.workflowRunId, 10),
      );

      // Update deployment based on workflow status
      if (status.status === 'completed') {
        if (status.conclusion === 'success') {
          deployment.status = DeploymentStatus.SUCCESS;
          deployment.deploymentUrl = status.deploymentUrl;
          deployment.completedAt = new Date();
        } else if (status.conclusion === 'failure' || status.conclusion === 'cancelled') {
          deployment.status = DeploymentStatus.FAILED;
          deployment.errorMessage = `GitHub workflow ${status.conclusion}`;
        }

        await this.deploymentRepository.save(deployment);
      }

      return deployment;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error updating deployment status: ${error.message}`);
      return deployment;
    }
  }
}
