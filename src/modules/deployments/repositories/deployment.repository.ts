import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { DeepPartial, EntityManager, FindOptionsWhere, Repository } from 'typeorm';

import { FilterDeploymentDto } from '../dto/filter.dto';
import { Deployment, DeploymentStatus } from '../entities/deployment.entity';

/**
 * Data structure for creating a new deployment
 */
export interface CreateDeploymentData {
  project_id: string;
  configuration_id: string;
  owner_id: string;
  environment: string;
  branch: string;
  environment_variables: unknown[];
  license_id: string;
  user_license_id?: string | null;
  site_id?: string;
  deployment_url?: string;
  is_test?: boolean;
  status?: DeploymentStatus;
}

@Injectable()
export class DeploymentRepository {
  constructor(
    @InjectRepository(Deployment)
    private readonly repository: Repository<Deployment>,
  ) {}

  /**
   * Get the entity manager for transactions
   */
  get manager(): EntityManager {
    return this.repository.manager;
  }

  /**
   * Execute operations within a transaction
   */
  transaction<T>(operation: (transactionalEntityManager: EntityManager) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(operation);
  }

  /**
   * Create a new deployment entity (without saving)
   */
  create(data: DeepPartial<Deployment>): Deployment {
    return this.repository.create(data);
  }

  /**
   * Save a deployment entity
   */
  save(deployment: Deployment): Promise<Deployment> {
    return this.repository.save(deployment);
  }

  /**
   * Create and save a new deployment
   */
  createAndSave(data: DeepPartial<Deployment>): Promise<Deployment> {
    const deployment = this.create(data);
    return this.save(deployment);
  }

  /**
   * Find deployment by ID
   */
  findById(id: string): Promise<Deployment | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Find deployment by ID or throw NotFoundException
   */
  async findByIdOrFail(id: string): Promise<Deployment> {
    const deployment = await this.findById(id);
    if (!deployment) {
      throw new NotFoundException(`Deployment with ID "${id}" not found`);
    }
    return deployment;
  }

  /**
   * Find deployment by ID with relations
   */
  findByIdWithRelations(
    id: string,
    relations: string[] = ['project', 'configuration'],
  ): Promise<Deployment | null> {
    return this.repository.findOne({
      where: { id },
      relations,
    });
  }

  /**
   * Find deployment by ID with relations or throw NotFoundException
   */
  async findByIdWithRelationsOrFail(
    id: string,
    relations: string[] = ['project', 'configuration'],
  ): Promise<Deployment> {
    const deployment = await this.findByIdWithRelations(id, relations);
    if (!deployment) {
      throw new NotFoundException(`Deployment with ID "${id}" not found`);
    }
    return deployment;
  }

  /**
   * Find deployments by project ID
   */
  findByProjectId(projectId: string): Promise<Deployment[]> {
    return this.repository.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find recent deployments for a project (for round-robin account selection)
   */
  findRecentByProjectId(projectId: string, take: number): Promise<Deployment[]> {
    return this.repository.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
      take,
    });
  }

  /**
   * Find deployments by owner ID
   */
  findByOwnerId(ownerId: string): Promise<Deployment[]> {
    return this.repository.find({
      where: { owner_id: ownerId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find deployments with custom where conditions
   */
  findBy(where: FindOptionsWhere<Deployment>): Promise<Deployment[]> {
    return this.repository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find one deployment with custom where conditions
   */
  findOneBy(where: FindOptionsWhere<Deployment>): Promise<Deployment | null> {
    return this.repository.findOne({ where });
  }

  /**
   * Get paginated deployments with filters
   */
  findPaginated(
    filterDto: FilterDeploymentDto,
    options: IPaginationOptions,
  ): Promise<Pagination<Deployment>> {
    const queryBuilder = this.repository.createQueryBuilder('deployment');

    // Filter by project if provided
    if (filterDto.projectId) {
      queryBuilder.where('deployment.project_id = :projectId', {
        projectId: filterDto.projectId,
      });
    }

    // Apply optional filters
    if (filterDto.ownerId) {
      queryBuilder.andWhere('deployment.owner_id = :ownerId', {
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

    // Always order by created_at DESC (newest first)
    queryBuilder.orderBy('deployment.created_at', 'DESC');

    // Add relations
    queryBuilder.leftJoinAndSelect('deployment.project', 'project');
    queryBuilder.leftJoinAndSelect('deployment.configuration', 'configuration');

    return paginate<Deployment>(queryBuilder, options);
  }

  /**
   * Update deployment status
   */
  async updateStatus(
    id: string,
    status: DeploymentStatus,
    additionalFields?: Partial<Deployment>,
  ): Promise<Deployment> {
    const deployment = await this.findByIdOrFail(id);
    deployment.status = status;

    if (additionalFields) {
      Object.assign(deployment, additionalFields);
    }

    return this.save(deployment);
  }

  /**
   * Update deployment URL
   */
  async updateDeploymentUrl(id: string, url: string): Promise<Deployment> {
    const deployment = await this.findByIdOrFail(id);
    deployment.deployment_url = url;
    return this.save(deployment);
  }

  /**
   * Update deployment with partial data
   */
  async update(id: string, data: Partial<Deployment>): Promise<Deployment> {
    const deployment = await this.findByIdOrFail(id);
    Object.assign(deployment, data);
    return this.save(deployment);
  }

  /**
   * Mark deployment as failed
   */
  markAsFailed(id: string, errorMessage: string): Promise<Deployment> {
    return this.updateStatus(id, DeploymentStatus.FAILED, {
      error_message: errorMessage,
    });
  }

  /**
   * Mark deployment as running
   */
  markAsRunning(
    id: string,
    workflowRunId: string,
    githubAccount?: Deployment['github_account'],
  ): Promise<Deployment> {
    return this.updateStatus(id, DeploymentStatus.RUNNING, {
      workflow_run_id: workflowRunId,
      github_account: githubAccount,
    });
  }

  /**
   * Mark deployment as success
   */
  markAsSuccess(id: string, deploymentUrl?: string): Promise<Deployment> {
    return this.updateStatus(id, DeploymentStatus.SUCCESS, {
      deployment_url: deploymentUrl,
      completed_at: new Date(),
    });
  }

  /**
   * Clear webhook info from deployment
   */
  async clearWebhookInfo(id: string): Promise<Deployment> {
    const deployment = await this.findByIdOrFail(id);
    deployment.webhook_info = undefined;
    return this.save(deployment);
  }

  /**
   * Set webhook info on deployment
   */
  async setWebhookInfo(
    id: string,
    webhookInfo: { hookId: number; repositoryOwner: string; repositoryName: string },
  ): Promise<Deployment> {
    const deployment = await this.findByIdOrFail(id);
    deployment.webhook_info = webhookInfo;
    return this.save(deployment);
  }

  /**
   * Count deployments by owner
   */
  countByOwner(ownerId: string): Promise<number> {
    return this.repository.count({
      where: { owner_id: ownerId },
    });
  }

  /**
   * Count deployments by project
   */
  countByProject(projectId: string): Promise<number> {
    return this.repository.count({
      where: { project_id: projectId },
    });
  }

  /**
   * Count deployments by status
   */
  countByStatus(status: DeploymentStatus): Promise<number> {
    return this.repository.count({
      where: { status },
    });
  }

  /**
   * Find deployments by status
   */
  findByStatus(status: DeploymentStatus): Promise<Deployment[]> {
    return this.repository.find({
      where: { status },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find running deployments (useful for status polling)
   */
  findRunningDeployments(): Promise<Deployment[]> {
    return this.findByStatus(DeploymentStatus.RUNNING);
  }

  /**
   * Find pending deployments
   */
  findPendingDeployments(): Promise<Deployment[]> {
    return this.findByStatus(DeploymentStatus.PENDING);
  }

  /**
   * Delete a deployment by ID
   */
  async delete(id: string): Promise<void> {
    const deployment = await this.findByIdOrFail(id);
    await this.repository.remove(deployment);
  }

  /**
   * Check if deployment exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }
}
