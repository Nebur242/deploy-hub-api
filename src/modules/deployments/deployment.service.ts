import { EncryptionService } from '@app/shared/encryption/encryption.service';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { DeepPartial, Repository } from 'typeorm';

import { DeploymentEntities } from './deployment.controller';
import { ServiceCreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { GitHubAccount } from './dto/github-account.dto';
import { Deployment, DeploymentStatus, DeplomentEnvironment } from './entities/deployment.entity';
import { GithubDeployerService } from './services/github-deployer.service';
import { GithubWebhookService } from './services/github-webhook.service';
import { DeploymentUrlExtractorService } from './services/url-extractor.service';
import { UserLicense } from '../licenses/entities/user-license.entity';
import { EnvironmentVariableDto } from '../projects/dto/create-project-configuration.dto';
import { ProjectConfiguration } from '../projects/entities/project-configuration.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    private encryptionService: EncryptionService,
    private readonly deployerService: GithubDeployerService,
    private readonly webhookService: GithubWebhookService,
    @InjectRepository(ProjectConfiguration)
    private projectConfigurationRepository: Repository<ProjectConfiguration>,
    private readonly deploymentUrlExtractorService: DeploymentUrlExtractorService,
    @InjectRepository(UserLicense)
    private userLicenseRepository: Repository<UserLicense>,
  ) {}

  /**
   * Create a new deployment using project GitHub accounts
   */
  async createDeployment(
    serviceCreateDeploymentDto: ServiceCreateDeploymentDto & { owner: User },
    entities: DeploymentEntities,
  ): Promise<Deployment> {
    // Create deployment record

    const { project, configuration, license, userLicense } = entities;

    // Check if user is project owner - project owners can deploy without a user license
    const isProjectOwner = project.ownerId === serviceCreateDeploymentDto.ownerId;

    if (isProjectOwner) {
      this.logger.log(
        `User ${serviceCreateDeploymentDto.ownerId} is the project owner for project ${project.id}. Creating deployment without user license validation.`,
      );
    }

    const deployment = this.deploymentRepository.create({
      projectId: serviceCreateDeploymentDto.projectId,
      configurationId: serviceCreateDeploymentDto.configurationId,
      configuration,
      deploymentUrl: serviceCreateDeploymentDto?.deploymentUrl || '',
      project,
      ownerId: serviceCreateDeploymentDto.ownerId,
      owner: serviceCreateDeploymentDto.owner,
      environment: serviceCreateDeploymentDto.environment,
      branch: serviceCreateDeploymentDto.branch,
      status: DeploymentStatus.PENDING,
      environmentVariables: serviceCreateDeploymentDto.environmentVariables,
      siteId: serviceCreateDeploymentDto.siteId || undefined,
      licenseId: serviceCreateDeploymentDto.licenseId,
      license,
      userLicense: isProjectOwner ? null : userLicense, // Project owners don't need user license
      userLicenseId: isProjectOwner ? null : userLicense?.id,
    } as DeepPartial<Deployment>);

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
    accounts: GitHubAccount[],
    recentDeployments: Deployment[],
  ): GitHubAccount[] {
    const githubAccounts = accounts.map(account => ({
      ...account,
      accessToken: this.encryptionService.decrypt(account.accessToken),
    }));
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

      // Create webhook for this repository to get real-time status updates
      try {
        // const { owner: repositoryOwner, name: repositoryName } =
        //   this.webhookService.extractRepositoryInfo(account.repository);

        const webhookResult = await this.webhookService.createDeploymentWebhook(
          githubAccount.username,
          githubAccount.repository,
          account.accessToken, // Using the decrypted token from orderedAccounts
          deployment.id,
        );

        if (webhookResult.success && webhookResult.hookId) {
          // Store webhook information in the deployment record
          deployment.webhookInfo = {
            hookId: webhookResult.hookId,
            repositoryOwner: githubAccount.username,
            repositoryName: githubAccount.repository,
          };
          this.logger.log(
            `Created webhook ${webhookResult.hookId} for deployment ${deployment.id}`,
          );
        } else {
          this.logger.warn(
            `Failed to create webhook for deployment ${deployment.id}: ${webhookResult.message}`,
          );
        }
      } catch (err) {
        const webhookError = err as Error;
        // Don't fail deployment if webhook creation fails
        this.logger.error(
          `Error creating webhook for deployment ${deployment.id}: ${webhookError.message}`,
          webhookError.stack,
        );
      }

      await this.deploymentRepository.save(deployment);
      return;
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Deployment with account ${account.username} failed: ${error.message}`);

      // Mark as failed since we're not trying multiple accounts
      deployment.status = DeploymentStatus.FAILED;
      deployment.errorMessage = error.message;
      await this.deploymentRepository.save(deployment);
      throw new BadGatewayException(
        `Deployment failed with account ${account.username}: ${error.message}`,
      );
    }
  }

  /**
   * Retry a failed deployment
   */
  async retryDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findOne({ where: { id: deploymentId } });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID "${deploymentId}" not found`);
    }

    if (deployment.status !== DeploymentStatus.FAILED) {
      throw new BadRequestException('Only failed deployments can be retried');
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
      environmentVariables: deployment.environmentVariables.map(env => ({
        ...env,
        defaultValue:
          env.isSecret && env.defaultValue
            ? this.encryptionService.decrypt(env.defaultValue)
            : env.defaultValue,
      })),
      ownerId: deployment.ownerId,
      siteId: deployment.siteId,
      licenseId: deployment.licenseId,
      userLicenseId: deployment.userLicenseId,
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

    if (!deployment.deploymentUrl) {
      const { logs } = await this.getDeploymentLogs(deployment);

      if (logs) {
        const url = this.deploymentUrlExtractorService.extractUrlFromLogs(logs, deployment);

        if (url) {
          deployment.deploymentUrl = url;
          await this.deploymentRepository.save(deployment);
        } else {
          this.logger.warn(`No deployment URL found in logs for deployment ${deploymentId}`);
        }
      }
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
  async getDeploymentLogs(deployment: Deployment): Promise<{ logs: string }> {
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
      this.logger.error(`Error fetching logs for deployment ${deployment.id}: ${error.message}`);
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
      let completedDeployment = false;

      if (status.status === 'completed') {
        if (status.conclusion === 'success') {
          deployment.status = DeploymentStatus.SUCCESS;
          deployment.deploymentUrl = status.deploymentUrl;
          deployment.completedAt = new Date();
          completedDeployment = true;

          // Update UserLicense count instead of DeploymentCount
          const userLicense = await this.userLicenseRepository.findOne({
            where: {
              licenseId: deployment.licenseId,
              ownerId: deployment.ownerId,
              active: true,
            },
          });

          if (userLicense) {
            userLicense.count = userLicense.count + 1;
            userLicense.deployments = [...userLicense.deployments, deployment.id];
            await this.userLicenseRepository.save(userLicense);
          }
        } else if (status.conclusion === 'failure' || status.conclusion === 'cancelled') {
          deployment.status = DeploymentStatus.FAILED;
          deployment.errorMessage = `GitHub workflow ${status.conclusion}`;
          completedDeployment = true;
        }

        await this.deploymentRepository.save(deployment);

        // Cleanup webhook if deployment is complete and webhook exists
        if (completedDeployment && deployment.webhookInfo && deployment.webhookInfo.hookId) {
          this.cleanupDeploymentWebhook(deployment).catch(err => {
            const error = err as Error;
            this.logger.error(`Failed to clean up webhook: ${error.message}`);
          });
        }
      }

      return deployment;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error updating deployment status: ${error.message}`);
      return deployment;
    }
  }

  /**
   * Clean up webhook after deployment completion
   */
  private async cleanupDeploymentWebhook(deployment: Deployment): Promise<void> {
    if (!deployment.webhookInfo || !deployment.webhookInfo.hookId || !deployment.githubAccount) {
      return;
    }

    try {
      const { hookId, repositoryOwner, repositoryName } = deployment.webhookInfo;
      const accessToken = this.encryptionService.decrypt(deployment.githubAccount.accessToken);

      const success = await this.webhookService.deleteDeploymentWebhook(
        repositoryOwner,
        repositoryName,
        accessToken,
        hookId,
      );

      if (success) {
        this.logger.log(`Cleaned up webhook ${hookId} for completed deployment ${deployment.id}`);

        // Remove webhook info from deployment
        deployment.webhookInfo = undefined;
        await this.deploymentRepository.save(deployment);
      } else {
        this.logger.warn(`Failed to delete webhook ${hookId} for deployment ${deployment.id}`);
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error deleting webhook for deployment ${deployment.id}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get user licenses with pagination and filters (replaces getDeploymentCounts)
   * @param filterDto Filter parameters
   * @param options Pagination options
   * @returns Paginated user licenses
   */
  getUserLicenses(
    filterDto: {
      licenseId?: string;
      ownerId?: string;
      createdFrom?: string;
      createdTo?: string;
      minCount?: number;
    },
    options: IPaginationOptions,
  ): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository.createQueryBuilder('userLicense');

    // Apply filters
    if (filterDto.licenseId) {
      queryBuilder.andWhere('userLicense.licenseId = :licenseId', {
        licenseId: filterDto.licenseId,
      });
    }

    if (filterDto.ownerId) {
      queryBuilder.andWhere('userLicense.ownerId = :ownerId', {
        ownerId: filterDto.ownerId,
      });
    }

    // Date range filters
    if (filterDto.createdFrom) {
      queryBuilder.andWhere('userLicense.createdAt >= :createdFrom', {
        createdFrom: filterDto.createdFrom,
      });
    }

    if (filterDto.createdTo) {
      queryBuilder.andWhere('userLicense.createdAt <= :createdTo', {
        createdTo: filterDto.createdTo,
      });
    }

    // Count filter
    if (filterDto.minCount !== undefined) {
      queryBuilder.andWhere('userLicense.count >= :minCount', {
        minCount: filterDto.minCount,
      });
    }

    // Add relations
    queryBuilder.leftJoinAndSelect('userLicense.owner', 'owner');

    // Order by creation date (newest first)
    queryBuilder.orderBy('userLicense.createdAt', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }

  /**
   * Redeploy an existing deployment with optional overrides
   * Creates a new deployment based on an existing deployment's configuration
   */
  async redeployDeployment(
    originalDeploymentId: string,
    overrides: {
      environment?: `${DeplomentEnvironment}`;
      branch?: string;
      environmentVariables?: EnvironmentVariableDto[];
    } = {},
    user: User,
  ): Promise<Deployment> {
    // Get the original deployment with all its related data
    const originalDeployment = await this.deploymentRepository.findOne({
      where: { id: originalDeploymentId },
      relations: ['project', 'configuration', 'license', 'userLicense'],
    });

    if (!originalDeployment) {
      throw new NotFoundException(`Deployment with ID "${originalDeploymentId}" not found`);
    }

    // Verify ownership
    if (originalDeployment.ownerId !== user.id) {
      throw new BadRequestException('You can only redeploy your own deployments');
    }

    // Verify the user license is still active and has available deployments
    const userLicense = await this.userLicenseRepository.findOne({
      where: {
        id: originalDeployment.userLicenseId,
        active: true,
      },
    });

    if (!userLicense) {
      throw new BadRequestException('User license is no longer active');
    }

    if (userLicense.count >= userLicense.maxDeployments) {
      throw new BadRequestException(
        `Deployment limit reached. Used ${userLicense.count}/${userLicense.maxDeployments} deployments.`,
      );
    }

    // Prepare the deployment configuration for redeployment
    // Decrypt environment variables from the original deployment
    const originalEnvVars = originalDeployment.environmentVariables.map(env => ({
      ...env,
      defaultValue: env.isSecret && env.defaultValue ? env.defaultValue : env.defaultValue,
    }));

    // Create deployment data using original deployment as base with optional overrides
    const deploymentData: ServiceCreateDeploymentDto & { owner: User } = {
      projectId: originalDeployment.projectId,
      licenseId: originalDeployment.licenseId,
      userLicenseId: originalDeployment.userLicenseId,
      configurationId: originalDeployment.configurationId,
      environment: overrides.environment || originalDeployment.environment,
      branch: overrides.branch || originalDeployment.branch,
      environmentVariables: overrides.environmentVariables || originalEnvVars,
      deploymentUrl: originalDeployment.deploymentUrl,
      ownerId: user.id,
      siteId: originalDeployment.siteId,
      owner: user,
    };

    // Create the entities object required for deployment
    const entities: DeploymentEntities = {
      project: originalDeployment.project,
      configuration: originalDeployment.configuration,
      license: originalDeployment.license,
      userLicense: originalDeployment.userLicense,
    };

    this.logger.log(
      `Creating redeployment for deployment ${originalDeploymentId} by user ${user.id}`,
    );

    // Create the new deployment using the existing createDeployment method
    return this.createDeployment(deploymentData, entities);
  }
}
