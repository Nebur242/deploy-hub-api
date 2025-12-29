import { EncryptionService } from '@app/shared/encryption/encryption.service';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { ServiceCreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { Deployment, DeploymentStatus, DeplomentEnvironment } from './entities/deployment.entity';
import {
  DeploymentEventType,
  DeploymentCreatedEvent,
  DeploymentStartedEvent,
  DeploymentCompletedEvent,
  DeploymentFailedEvent,
  DeploymentStatusUpdatedEvent,
  DeploymentWebhookCreatedEvent,
  DeploymentWebhookDeletedEvent,
  DeploymentCanceledEvent,
  DeploymentLockAcquiredEvent,
  DeploymentLockConflictEvent,
  DeploymentLockReleasedEvent,
} from './events/deployment.events';
import { DeploymentRepository } from './repositories/deployment.repository';
import { DeploymentConcurrencyService } from './services/deployment-concurrency.service';
import { GitHubAccountManagerService } from './services/github-account-manager.service';
import { GithubDeployerService } from './services/github-deployer.service';
import { GithubWebhookService } from './services/github-webhook.service';
import { DeploymentUrlExtractorService } from './services/url-extractor.service';
import {
  DeploymentEntities,
  DeploymentCancellationResult,
  GitHubAccountWithMetadata,
} from './types/deployment.types';
import { UserLicense } from '../license/entities/user-license.entity';
import { UserLicenseService } from '../license/services/user-license.service';
import { EnvironmentVariableDto } from '../project-config/dto/create-project-configuration.dto';
import { ProjectConfiguration } from '../project-config/entities/project-configuration.entity';
import { ProjectConfigurationService } from '../project-config/services/project-configuration.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly encryptionService: EncryptionService,
    private readonly deployerService: GithubDeployerService,
    private readonly webhookService: GithubWebhookService,
    private readonly projectConfigurationService: ProjectConfigurationService,
    private readonly deploymentUrlExtractorService: DeploymentUrlExtractorService,
    private readonly userLicenseService: UserLicenseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly githubAccountManager: GitHubAccountManagerService,
    private readonly concurrencyService: DeploymentConcurrencyService,
  ) {}

  /**
   * Create a new deployment using project GitHub accounts
   * Uses transaction for atomicity and concurrency control
   */
  async createDeployment(
    serviceCreateDeploymentDto: ServiceCreateDeploymentDto & { owner: User },
    entities: DeploymentEntities,
  ): Promise<Deployment> {
    const { project, configuration, license, userLicense } = entities;
    this.logger.log(`[SERVICE] Creating deployment for project ${project.id}`);
    this.logger.log(
      `[SERVICE] Configuration: ${configuration.id}, GitHub accounts: ${configuration.github_accounts?.length || 0}`,
    );

    // Check if user is project owner - project owners can deploy without a user license
    const isProjectOwner = project.owner_id === serviceCreateDeploymentDto.owner_id;
    this.logger.log(
      `[SERVICE] User ${serviceCreateDeploymentDto.owner_id} is project owner: ${isProjectOwner}`,
    );

    if (isProjectOwner) {
      this.logger.log(
        `[SERVICE] User ${serviceCreateDeploymentDto.owner_id} is the project owner for project ${project.id}. Creating deployment without user license validation.`,
      );
    }

    // Validate GitHub accounts are available
    this.logger.log(`[SERVICE] Validating GitHub accounts availability...`);
    if (!this.githubAccountManager.validateAccountsAvailable(configuration.github_accounts)) {
      this.logger.error(`[SERVICE] No GitHub accounts available for deployment`);
      throw new BadRequestException('No GitHub accounts available for deployment');
    }
    this.logger.log(
      `[SERVICE] GitHub accounts validated: ${configuration.github_accounts.length} account(s) available`,
    );

    // Check for conflicting deployments before creating (only for the same user)
    const deploymentEnvironment = serviceCreateDeploymentDto.environment as DeplomentEnvironment;
    const userId = serviceCreateDeploymentDto.owner_id;
    const conflicts = await this.concurrencyService.checkForConflictingDeployments(
      serviceCreateDeploymentDto.project_id,
      deploymentEnvironment,
      userId,
    );

    if (conflicts.length > 0) {
      const conflicting = conflicts[0];
      this.logger.warn(
        `Deployment conflict detected: user ${userId} already has deployment ${conflicting.id} (${conflicting.status}) for project ${serviceCreateDeploymentDto.project_id}`,
      );

      // Emit conflict event
      this.eventEmitter.emit(
        DeploymentEventType.DEPLOYMENT_LOCK_CONFLICT,
        new DeploymentLockConflictEvent(
          'new-deployment',
          serviceCreateDeploymentDto.project_id,
          deploymentEnvironment,
          conflicting.id,
        ),
      );

      throw new ConflictException(
        `You already have a deployment (${conflicting.id}) that is ${conflicting.status} ` +
          `for environment "${serviceCreateDeploymentDto.environment}". Please wait for it to complete or cancel it first.`,
      );
    }

    // Create deployment record within a transaction
    this.logger.log(`[SERVICE] Creating deployment record in database...`);
    const deployment = await this.deploymentRepository.transaction(manager => {
      const deploymentEntity = this.deploymentRepository.create({
        project_id: serviceCreateDeploymentDto.project_id,
        configuration_id: serviceCreateDeploymentDto.configuration_id,
        configuration,
        deployment_url: serviceCreateDeploymentDto?.deployment_url || '',
        project,
        owner_id: serviceCreateDeploymentDto.owner_id,
        owner: serviceCreateDeploymentDto.owner,
        environment: serviceCreateDeploymentDto.environment,
        branch: serviceCreateDeploymentDto.branch,
        status: DeploymentStatus.PENDING,
        environment_variables: serviceCreateDeploymentDto.environment_variables,
        site_id: serviceCreateDeploymentDto.site_id || undefined,
        license_id: serviceCreateDeploymentDto.license_id,
        license: license || undefined,
        user_license: isProjectOwner ? undefined : userLicense,
        user_license_id: isProjectOwner ? undefined : userLicense?.id,
        is_test: serviceCreateDeploymentDto.is_test === true,
      });

      return manager.save(Deployment, deploymentEntity);
    });
    this.logger.log(`[SERVICE] Deployment record created: ${deployment.id}`);

    // Acquire concurrency lock for this deployment (per-user lock)
    this.logger.log(`[SERVICE] Acquiring concurrency lock...`);
    const lockResult = await this.concurrencyService.acquireLock({
      projectId: serviceCreateDeploymentDto.project_id,
      environment: deploymentEnvironment,
      deploymentId: deployment.id,
      userId,
    });
    this.logger.log(`[SERVICE] Lock acquired: ${lockResult.acquired}`);

    if (lockResult.acquired) {
      this.eventEmitter.emit(
        DeploymentEventType.DEPLOYMENT_LOCK_ACQUIRED,
        new DeploymentLockAcquiredEvent(
          deployment.id,
          serviceCreateDeploymentDto.project_id,
          deploymentEnvironment,
        ),
      );
    }

    // Get recent deployments for round-robin account selection
    this.logger.log(`[SERVICE] Getting recent deployments for round-robin selection...`);
    const recentDeployments = await this.deploymentRepository.findRecentByProjectId(
      serviceCreateDeploymentDto.project_id,
      configuration.github_accounts.length > 0 ? configuration.github_accounts.length : 1,
    );
    this.logger.log(`[SERVICE] Found ${recentDeployments.length} recent deployments`);

    // Get ordered accounts using the GitHubAccountManagerService
    this.logger.log(`[SERVICE] Getting ordered GitHub accounts for deployment...`);
    const orderedAccounts = this.githubAccountManager.getOrderedAccountsForDeployment(
      configuration.github_accounts,
      recentDeployments,
    );
    this.logger.log(`[SERVICE] Got ${orderedAccounts.length} ordered accounts`);

    // Start deployment process
    this.logger.log(`[SERVICE] Starting deployment process...`);
    try {
      await this.triggerDeployment(
        deployment,
        configuration,
        serviceCreateDeploymentDto,
        orderedAccounts,
      );
      this.logger.log(`[SERVICE] Deployment ${deployment.id} started successfully`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`[SERVICE] Deployment ${deployment.id} failed: ${error.message}`);
      this.logger.error(`[SERVICE] Stack trace: ${error.stack}`);
      await this.deploymentRepository.markAsFailed(deployment.id, error.message);

      // Release the lock on failure
      this.concurrencyService.releaseLockByDeploymentId(deployment.id);

      // Emit deployment failed event
      this.eventEmitter.emit(
        DeploymentEventType.DEPLOYMENT_FAILED,
        new DeploymentFailedEvent(
          deployment.id,
          error.message,
          serviceCreateDeploymentDto.owner_id,
        ),
      );
    }

    // Emit deployment created event
    this.eventEmitter.emit(
      DeploymentEventType.DEPLOYMENT_CREATED,
      new DeploymentCreatedEvent(
        deployment.id,
        deployment,
        serviceCreateDeploymentDto.owner_id,
        isProjectOwner,
        serviceCreateDeploymentDto.is_test === true,
      ),
    );

    this.logger.log(
      `[SERVICE] Deployment creation complete, returning deployment ${deployment.id}`,
    );
    return deployment;
  }

  /**
   * Trigger the deployment workflow
   */
  private async triggerDeployment(
    deployment: Deployment,
    configuration: ProjectConfiguration,
    deploymentConfig: ServiceCreateDeploymentDto,
    orderedAccounts: GitHubAccountWithMetadata[],
  ): Promise<void> {
    this.logger.log(`[TRIGGER] Starting triggerDeployment for deployment ${deployment.id}`);

    // Select the best account for deployment
    const account = this.githubAccountManager.selectAccountForDeployment(orderedAccounts);
    this.logger.log(`[TRIGGER] Selected account: ${account?.username || 'none'}`);

    if (!account) {
      throw new Error('No GitHub accounts available for deployment');
    }

    try {
      this.logger.log(`[TRIGGER] Calling deployToGitHub with account ${account.username}...`);
      const result = await this.deployerService.deployToGitHub(
        deployment,
        account,
        deploymentConfig,
      );
      this.logger.log(`[TRIGGER] deployToGitHub result: workflowRunId=${result.workflowRunId}`);

      // Success - update deployment with result (encrypt token before storing)
      deployment.github_account = this.githubAccountManager.createDeploymentAccountInfo(account);
      deployment.workflow_run_id = `${result.workflowRunId}`;
      deployment.status = DeploymentStatus.RUNNING;

      // Emit deployment started event
      this.eventEmitter.emit(
        DeploymentEventType.DEPLOYMENT_STARTED,
        new DeploymentStartedEvent(deployment.id, deployment.workflow_run_id, account.username),
      );

      // Create webhook for this repository to get real-time status updates
      try {
        const webhookResult = await this.webhookService.createDeploymentWebhook(
          account.username,
          account.repository,
          account.access_token,
          deployment.id,
        );

        if (webhookResult.success && webhookResult.hookId) {
          // Store webhook information in the deployment record
          deployment.webhook_info = {
            hookId: webhookResult.hookId,
            repositoryOwner: account.username,
            repositoryName: account.repository,
          };
          this.logger.log(
            `Created webhook ${webhookResult.hookId} for deployment ${deployment.id}`,
          );

          // Emit webhook created event
          this.eventEmitter.emit(
            DeploymentEventType.DEPLOYMENT_WEBHOOK_CREATED,
            new DeploymentWebhookCreatedEvent(
              deployment.id,
              webhookResult.hookId,
              account.username,
              account.repository,
            ),
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
      await this.deploymentRepository.markAsFailed(deployment.id, error.message);
      throw new BadGatewayException(
        `Deployment failed with account ${account.username}: ${error.message}`,
      );
    }
  }

  /**
   * Retry a failed deployment
   */
  async retryDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findById(deploymentId);

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID "${deploymentId}" not found`);
    }

    if (deployment.status !== DeploymentStatus.FAILED) {
      throw new BadRequestException('Only failed deployments can be retried');
    }

    // Reset deployment status for retry
    await this.deploymentRepository.update(deploymentId, {
      status: DeploymentStatus.PENDING,
      error_message: '',
    });

    // Find project configuration using service instead of repository
    const configuration = await this.projectConfigurationService.findOne(
      deployment.configuration_id,
    );

    if (!configuration) {
      throw new NotFoundException(
        `Configuration with ID "${deployment.configuration_id}" not found`,
      );
    }

    // Get recent deployments to determine order
    const recentDeployments = await this.deploymentRepository.findRecentByProjectId(
      deployment.project_id,
      configuration.github_accounts.length > 0 ? configuration.github_accounts.length : 1,
    );

    // Get ordered accounts using GitHubAccountManagerService, excluding the last failed account
    const orderedAccounts = this.githubAccountManager.getOrderedAccountsForRetry(
      configuration.github_accounts,
      recentDeployments,
      deployment.github_account?.username,
    );

    // Create deployment config from stored deployment
    const deploymentConfig: ServiceCreateDeploymentDto = {
      project_id: deployment.project_id,
      configuration_id: configuration.id,
      environment: deployment.environment,
      branch: deployment.branch,
      environment_variables: deployment.environment_variables.map(env => ({
        ...env,
        default_value:
          env.is_secret && env.default_value
            ? this.encryptionService.safeDecrypt(env.default_value)
            : env.default_value,
      })),
      owner_id: deployment.owner_id,
      site_id: deployment.site_id,
      license_id: deployment.license_id ?? undefined,
      user_license_id: deployment.user_license_id,
    };

    // Trigger deployment with reordered accounts
    try {
      await this.triggerDeployment(deployment, configuration, deploymentConfig, orderedAccounts);
      this.logger.log(`Deployment ${deployment.id} retry started successfully`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Deployment ${deployment.id} retry failed: ${error.message}`);
      await this.deploymentRepository.markAsFailed(deployment.id, error.message);
    }

    // Return updated deployment
    return this.deploymentRepository.findByIdOrFail(deploymentId);
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findByIdWithRelationsOrFail(deploymentId);

    if (!deployment.deployment_url) {
      const { logs } = await this.getDeploymentLogs(deployment);

      if (logs) {
        const url = this.deploymentUrlExtractorService.extractUrlFromLogs(logs, deployment);

        if (url) {
          await this.deploymentRepository.updateDeploymentUrl(deploymentId, url);
          deployment.deployment_url = url;
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
    return this.deploymentRepository.findByProjectId(projectId);
  }

  /**
   * Get paginated deployments with filters
   */
  getDeployments(
    filterDto: FilterDeploymentDto,
    options: IPaginationOptions,
  ): Promise<Pagination<Deployment>> {
    return this.deploymentRepository.findPaginated(filterDto, options);
  }

  /**
   * Get logs for a deployment
   */
  async getDeploymentLogs(deployment: Deployment): Promise<{ logs: string }> {
    this.logger.log(`[LOGS] Getting logs for deployment ${deployment.id}`);

    if (!deployment.github_account || !deployment.workflow_run_id) {
      this.logger.warn(`[LOGS] No workflow info for deployment ${deployment.id}`);
      return { logs: 'No workflow information available for this deployment' };
    }

    this.logger.log(
      `[LOGS] GitHub account: ${deployment.github_account.username}, workflow_run_id: ${deployment.workflow_run_id}`,
    );

    try {
      const decryptedToken = this.githubAccountManager.getDecryptedToken(deployment);

      if (!decryptedToken) {
        this.logger.error(`[LOGS] Failed to decrypt token for deployment ${deployment.id}`);
        return { logs: 'Error: Unable to decrypt GitHub token' };
      }

      this.logger.log(`[LOGS] Token decrypted, length: ${decryptedToken.length}`);

      const logs = await this.deployerService.getWorkflowLogs(
        {
          username: deployment.github_account.username,
          access_token: decryptedToken,
          repository: deployment.github_account.repository,
        },
        parseInt(deployment.workflow_run_id, 10),
      );

      this.logger.log(`[LOGS] Successfully retrieved logs, length: ${logs.length}`);
      return { logs };
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `[LOGS] Error fetching logs for deployment ${deployment.id}: ${error.message}`,
      );
      this.logger.error(`[LOGS] Stack: ${error.stack}`);
      return { logs: `Error fetching logs: ${error.message}` };
    }
  }

  /**
   * Update deployment status from GitHub workflow
   * This should be called periodically or webhook-triggered
   */
  async updateDeploymentStatus(deploymentId: string): Promise<Deployment> {
    let deployment = await this.getDeployment(deploymentId);

    // Only check running deployments
    if (
      deployment.status !== DeploymentStatus.RUNNING ||
      !deployment.github_account ||
      !deployment.workflow_run_id
    ) {
      return deployment;
    }

    const previousStatus = deployment.status as DeploymentStatus;

    try {
      // Check workflow status using decrypted token
      const decryptedToken = this.githubAccountManager.getDecryptedToken(deployment);

      if (!decryptedToken) {
        this.logger.error(`No valid GitHub token for deployment ${deploymentId}`);
        return deployment;
      }

      const status = await this.deployerService.checkWorkflowStatus(
        {
          username: deployment.github_account.username,
          access_token: decryptedToken,
          repository: deployment.github_account.repository,
        },

        parseInt(deployment.workflow_run_id, 10),
      );

      // Update deployment based on workflow status
      let completedDeployment = false;
      const isProjectOwner = deployment.project?.owner_id === deployment.owner_id;

      if (status.status === 'completed') {
        if (status.conclusion === 'success') {
          deployment = await this.deploymentRepository.markAsSuccess(
            deploymentId,
            status.deploymentUrl,
          );
          completedDeployment = true;

          // Emit deployment completed event (listener will handle user license update)
          this.eventEmitter.emit(
            DeploymentEventType.DEPLOYMENT_COMPLETED,
            new DeploymentCompletedEvent(
              deployment.id,
              deployment,
              deployment.deployment_url || null,
              deployment.owner_id,
              isProjectOwner,
            ),
          );
        } else if (status.conclusion === 'failure' || status.conclusion === 'cancelled') {
          deployment = await this.deploymentRepository.markAsFailed(
            deploymentId,
            `GitHub workflow ${status.conclusion}`,
          );
          completedDeployment = true;

          // Emit deployment failed event
          this.eventEmitter.emit(
            DeploymentEventType.DEPLOYMENT_FAILED,
            new DeploymentFailedEvent(
              deployment.id,
              deployment.error_message || '',
              deployment.owner_id,
            ),
          );
        }

        // Release concurrency lock when deployment completes
        if (completedDeployment) {
          const lockReleased = this.concurrencyService.releaseLockByDeploymentId(deploymentId);
          if (lockReleased) {
            this.eventEmitter.emit(
              DeploymentEventType.DEPLOYMENT_LOCK_RELEASED,
              new DeploymentLockReleasedEvent(
                deploymentId,
                deployment.project_id,
                deployment.environment,
              ),
            );
          }
        }

        // Emit status updated event
        this.eventEmitter.emit(
          DeploymentEventType.DEPLOYMENT_STATUS_UPDATED,
          new DeploymentStatusUpdatedEvent(
            deployment.id,
            previousStatus,
            deployment.status as DeploymentStatus,
            deployment.deployment_url,
          ),
        );

        // Cleanup webhook if deployment is complete and webhook exists
        if (completedDeployment && deployment.webhook_info && deployment.webhook_info.hookId) {
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
    if (!deployment.webhook_info || !deployment.webhook_info.hookId || !deployment.github_account) {
      return;
    }

    try {
      const { hookId, repositoryOwner, repositoryName } = deployment.webhook_info;
      const accessToken = this.githubAccountManager.getDecryptedToken(deployment);

      if (!accessToken) {
        this.logger.error(
          `No valid GitHub token for webhook cleanup on deployment ${deployment.id}`,
        );
        return;
      }

      const success = await this.webhookService.deleteDeploymentWebhook(
        repositoryOwner,
        repositoryName,
        accessToken,
        hookId,
      );

      if (success) {
        this.logger.log(`Cleaned up webhook ${hookId} for completed deployment ${deployment.id}`);

        // Emit webhook deleted event
        this.eventEmitter.emit(
          DeploymentEventType.DEPLOYMENT_WEBHOOK_DELETED,
          new DeploymentWebhookDeletedEvent(deployment.id, hookId),
        );

        // Remove webhook info from deployment
        await this.deploymentRepository.clearWebhookInfo(deployment.id);
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
    const originalDeployment = await this.deploymentRepository.findByIdWithRelations(
      originalDeploymentId,
      ['project', 'configuration', 'license', 'userLicense'],
    );

    if (!originalDeployment) {
      throw new NotFoundException(`Deployment with ID "${originalDeploymentId}" not found`);
    }

    // Verify ownership
    if (originalDeployment.owner_id !== user.id) {
      throw new BadRequestException('You can only redeploy your own deployments');
    }

    // Check if the user is the project owner
    const isProjectOwner = originalDeployment.project.owner_id === user.id;

    // Verify the user license is still active and has available deployments
    // Project owners don't need a user license
    let userLicense: UserLicense | null = null;

    if (!isProjectOwner && originalDeployment.user_license_id) {
      try {
        userLicense = await this.userLicenseService.getUserLicenseById(
          originalDeployment.user_license_id,
        );

        if (!userLicense.active) {
          throw new BadRequestException('User license is no longer active');
        }

        const hasAvailable = await this.userLicenseService.hasAvailableDeployments(
          originalDeployment.user_license_id,
        );

        if (!hasAvailable) {
          throw new BadRequestException(
            `Deployment limit reached. Used ${userLicense.count}/${userLicense.max_deployments} deployments.`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('User license is no longer active');
      }
    }

    // Prepare the deployment configuration for redeployment
    // Decrypt environment variables from the original deployment
    const originalEnvVars = originalDeployment.environment_variables.map(env => ({
      ...env,
      default_value: env.is_secret && env.default_value ? env.default_value : env.default_value,
    }));

    // Create deployment data using original deployment as base with optional overrides
    const deploymentData: ServiceCreateDeploymentDto & { owner: User } = {
      project_id: originalDeployment.project_id,
      license_id: originalDeployment.license_id ?? undefined,
      user_license_id: originalDeployment.user_license_id,
      configuration_id: originalDeployment.configuration_id,
      environment: overrides.environment || originalDeployment.environment,
      branch: overrides.branch || originalDeployment.branch,
      environment_variables: overrides.environmentVariables || originalEnvVars,
      deployment_url: originalDeployment.deployment_url,
      owner_id: user.id,
      site_id: originalDeployment.site_id,
      owner: user,
    };

    // Create the entities object required for deployment
    const entities: DeploymentEntities = {
      project: originalDeployment.project,
      configuration: originalDeployment.configuration,
      license: originalDeployment.license,
      userLicense: userLicense, // Use the freshly fetched userLicense
    };

    this.logger.log(
      `Creating redeployment for deployment ${originalDeploymentId} by user ${user.id}`,
    );

    // Emit redeployment event
    const newDeployment = await this.createDeployment(deploymentData, entities);

    this.eventEmitter.emit(DeploymentEventType.DEPLOYMENT_REDEPLOYED, {
      deploymentId: newDeployment.id,
      originalDeploymentId,
      deployment: newDeployment,
      user,
      timestamp: new Date(),
    });

    return newDeployment;
  }

  /**
   * Cancel a running deployment
   * Only deployments with PENDING or RUNNING status can be cancelled
   */
  async cancelDeployment(
    deploymentId: string,
    userId: string,
  ): Promise<DeploymentCancellationResult> {
    const deployment = await this.deploymentRepository.findByIdWithRelationsOrFail(deploymentId);

    // Verify ownership
    if (deployment.owner_id !== userId) {
      throw new BadRequestException('You can only cancel your own deployments');
    }

    // Check if deployment can be cancelled
    if (
      deployment.status !== DeploymentStatus.PENDING &&
      deployment.status !== DeploymentStatus.RUNNING
    ) {
      return {
        success: false,
        message: `Cannot cancel deployment with status: ${deployment.status}`,
      };
    }

    // If deployment is running, try to cancel the GitHub workflow
    if (
      deployment.status === DeploymentStatus.RUNNING &&
      deployment.github_account &&
      deployment.workflow_run_id
    ) {
      const decryptedToken = this.githubAccountManager.getDecryptedToken(deployment);

      if (decryptedToken) {
        const cancelResult = await this.deployerService.cancelWorkflowRun(
          {
            username: deployment.github_account.username,
            access_token: decryptedToken,
            repository: deployment.github_account.repository,
          },
          parseInt(deployment.workflow_run_id, 10),
        );

        if (!cancelResult.success) {
          this.logger.warn(`Failed to cancel GitHub workflow: ${cancelResult.message}`);
          // Continue to mark as cancelled even if GitHub cancellation fails
        }
      }
    }

    // Update deployment status to CANCELED
    await this.deploymentRepository.updateStatus(deploymentId, DeploymentStatus.CANCELED);

    // Release concurrency lock
    const lockReleased = this.concurrencyService.releaseLockByDeploymentId(deploymentId);
    if (lockReleased) {
      this.eventEmitter.emit(
        DeploymentEventType.DEPLOYMENT_LOCK_RELEASED,
        new DeploymentLockReleasedEvent(
          deploymentId,
          deployment.project_id,
          deployment.environment,
        ),
      );
    }

    // Clean up webhook if exists
    if (deployment.webhook_info?.hookId) {
      this.cleanupDeploymentWebhook(deployment).catch(err => {
        const error = err as Error;
        this.logger.error(`Failed to clean up webhook during cancellation: ${error.message}`);
      });
    }

    this.logger.log(`Deployment ${deploymentId} cancelled by user ${userId}`);

    // Emit cancellation event
    this.eventEmitter.emit(
      DeploymentEventType.DEPLOYMENT_CANCELED,
      new DeploymentCanceledEvent(
        deploymentId,
        userId,
        'User requested cancellation',
        deployment.status === DeploymentStatus.RUNNING,
      ),
    );

    // Also emit status update for backwards compatibility
    this.eventEmitter.emit(DeploymentEventType.DEPLOYMENT_STATUS_UPDATED, {
      deploymentId,
      previousStatus: deployment.status,
      newStatus: DeploymentStatus.CANCELED,
      userId,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: 'Deployment cancelled successfully',
    };
  }
}
