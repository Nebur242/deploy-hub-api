import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { DeploymentEntity } from './entities/deployment.entity';
import { DeploymentController as GithubDeploymentController } from './github-deployer.controller';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);
  private readonly maxRetries = 3;

  constructor(
    @InjectRepository(DeploymentEntity)
    private deploymentRepository: Repository<DeploymentEntity>,
    private githubDeploymentController: GithubDeploymentController,
  ) {}

  /**
   * Create a new deployment
   */
  async createDeployment(createDeploymentDto: CreateDeploymentDto): Promise<DeploymentEntity> {
    const deployment = this.deploymentRepository.create({
      userId: createDeploymentDto.id || createDeploymentDto.name,
      userName: createDeploymentDto.name,
      environment: createDeploymentDto.environment || 'production',
      branch: createDeploymentDto.branch || 'main',
      vercelProjectId: createDeploymentDto.vercelProjectId,
      vercelOrgId: createDeploymentDto.vercelOrgId,
      status: 'pending',
    });

    await this.deploymentRepository.save(deployment);

    // Trigger the deployment
    await this.triggerDeployment(deployment, createDeploymentDto);

    return deployment;
  }

  /**
   * Batch create deployments
   */
  async batchDeployment(deployments: CreateDeploymentDto[]): Promise<DeploymentEntity[]> {
    const results: DeploymentEntity[] = [];

    for (const dto of deployments) {
      try {
        const deployment = await this.createDeployment(dto);
        results.push(deployment);
      } catch (err) {
        const error = err as Error;
        this.logger.error(`Error creating deployment for ${dto.name}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get all deployments with optional filters
   */
  getAllDeployments(
    status?: string,
    userId?: string,
    environment?: string,
  ): Promise<DeploymentEntity[]> {
    const query = this.deploymentRepository.createQueryBuilder('deployment');

    if (status) {
      query.andWhere('deployment.status = :status', { status });
    }

    if (userId) {
      query.andWhere('deployment.userId = :userId', { userId });
    }

    if (environment) {
      query.andWhere('deployment.environment = :environment', { environment });
    }

    query.orderBy('deployment.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(id: string): Promise<DeploymentEntity> {
    const deployment = await this.deploymentRepository.findOne({ where: { id } });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID "${id}" not found`);
    }

    return deployment;
  }

  /**
   * Trigger a deployment using the GitHub deployer
   */
  private async triggerDeployment(
    deployment: DeploymentEntity,
    config: CreateDeploymentDto,
  ): Promise<void> {
    try {
      const result = await this.githubDeploymentController.deployForUser({
        id: deployment.userId,
        name: deployment.userName,
        vercelToken: config.vercelToken,
        vercelProjectId: config.vercelProjectId,
        vercelOrgId: config.vercelOrgId,
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
        environment: deployment.environment,
        branch: deployment.branch,
      });

      // Update deployment with result
      deployment.status = result.success ? 'running' : 'failed';
      deployment.githubAccount = result.account ?? '';
      deployment.workflowRunId = result.runId ?? 0;
      deployment.errorMessage = result.error ?? '';

      if (!result.success && deployment.retryCount < this.maxRetries) {
        deployment.retryCount += 1;
        this.logger.log(
          `Auto-retrying deployment ${deployment.id} (Attempt ${deployment.retryCount}/${this.maxRetries})`,
        );
      }

      await this.deploymentRepository.save(deployment);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error triggering deployment: ${error.message}`);

      deployment.status = 'failed';
      deployment.errorMessage = error.message;
      await this.deploymentRepository.save(deployment);

      throw error;
    }
  }

  /**
   * Retry a failed deployment
   */
  async retryDeployment(id: string): Promise<DeploymentEntity> {
    const deployment = await this.getDeploymentById(id);

    if (deployment.status !== 'failed' && deployment.status !== 'pending') {
      throw new Error(
        `Deployment with ID "${id}" is currently ${deployment.status} and cannot be retried`,
      );
    }

    // Reset deployment status
    deployment.status = 'pending';
    deployment.retryCount += 1;
    deployment.errorMessage = '';

    await this.deploymentRepository.save(deployment);

    // Get the original configuration from stored data
    const config: CreateDeploymentDto = {
      id: deployment.userId,
      name: deployment.userName,
      // We need to fetch these from a secure storage in a real app
      // Here we're demonstrating the pattern but not the actual secure implementation
      vercelToken: process.env[`VERCEL_TOKEN_${deployment.userId}`] || '',
      vercelProjectId: deployment.vercelProjectId,
      vercelOrgId: deployment.vercelOrgId,
      supabaseUrl: process.env[`SUPABASE_URL_${deployment.userId}`] || '',
      supabaseAnonKey: process.env[`SUPABASE_ANON_KEY_${deployment.userId}`] || '',
      environment: deployment.environment,
      branch: deployment.branch,
    };

    // Re-trigger the deployment
    await this.triggerDeployment(deployment, config);

    return deployment;
  }

  /**
   * Trigger deployments for a specific environment (production/preview)
   */
  triggerEnvironmentDeployments(
    environment: 'production' | 'preview',
  ): Promise<DeploymentEntity[]> {
    // In a real application, you would load user configurations from a database
    // For demonstration purposes, we'll use environment variables

    const configKeys = Object.keys(process.env).filter(
      key =>
        key.startsWith('USER_ID_') &&
        process.env[`USER_ENV_${key.replace('USER_ID_', '')}`] === environment,
    );

    const deploymentDtos: CreateDeploymentDto[] = configKeys.map(key => {
      const userId = process.env[key] || '';
      const userPrefix = key.replace('USER_ID_', '');

      return {
        id: userId,
        name: process.env[`USER_NAME_${userPrefix}`] || userId,
        vercelToken: process.env[`VERCEL_TOKEN_${userPrefix}`] || '',
        vercelProjectId: process.env[`VERCEL_PROJECT_ID_${userPrefix}`] || '',
        vercelOrgId: process.env[`VERCEL_ORG_ID_${userPrefix}`] || '',
        supabaseUrl: process.env[`SUPABASE_URL_${userPrefix}`] || '',
        supabaseAnonKey: process.env[`SUPABASE_ANON_KEY_${userPrefix}`] || '',
        environment: environment,
        branch: process.env[`USER_BRANCH_${userPrefix}`] || 'main',
      };
    });

    return this.batchDeployment(deploymentDtos);
  }

  /**
   * Scheduled job to check the status of running deployments
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDeploymentStatuses() {
    this.logger.debug('Checking status of running deployments');

    const runningDeployments = await this.deploymentRepository.find({
      where: { status: 'running' },
    });

    if (runningDeployments.length === 0) {
      return;
    }

    this.logger.log(`Checking status of ${runningDeployments.length} running deployments`);

    for (const deployment of runningDeployments) {
      try {
        if (!deployment.githubAccount || !deployment.workflowRunId) {
          continue;
        }

        const status = await this.githubDeploymentController.checkStatus({
          success: true,
          userId: deployment.userId,
          userName: deployment.userName,
          environment: deployment.environment,
          account: deployment.githubAccount,
          runId: deployment.workflowRunId,
          timestamp: deployment.createdAt,
        });

        // Update status based on GitHub workflow status
        if (status.conclusion === 'success') {
          deployment.status = 'success';
          deployment.deploymentUrl = status.deploymentUrl || '';
          deployment.completedAt = new Date();
        } else if (status.conclusion === 'failure' || status.conclusion === 'cancelled') {
          deployment.status = 'failed';
          deployment.errorMessage = `GitHub workflow ${status.conclusion}`;

          // Auto-retry logic
          if (deployment.retryCount < this.maxRetries) {
            await this.retryDeployment(deployment.id);
          }
        }

        await this.deploymentRepository.save(deployment);
      } catch (err) {
        const error = err as Error;
        this.logger.error(
          `Error checking status for deployment ${deployment.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Scheduled job to retry failed deployments with a cooldown period
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedDeployments() {
    this.logger.debug('Looking for failed deployments to retry');

    // Find failed deployments that haven't exceeded max retries
    // and haven't been updated in the last 10 minutes
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const failedDeployments = await this.deploymentRepository.find({
      where: {
        status: 'failed',
        retryCount: LessThan(this.maxRetries), // Less than max retries
        updatedAt: LessThan(tenMinutesAgo), // Not updated in last 10 minutes
      },
    });

    if (failedDeployments.length === 0) {
      return;
    }

    this.logger.log(`Auto-retrying ${failedDeployments.length} failed deployments`);

    for (const deployment of failedDeployments) {
      try {
        await this.retryDeployment(deployment.id);
      } catch (err) {
        const error = err as Error;
        this.logger.error(`Error retrying deployment ${deployment.id}: ${error.message}`);
      }
    }
  }
}
