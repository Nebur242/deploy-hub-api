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

/**
 * Raw query result interfaces for statistics
 */
interface StatsRawResult {
  total: string;
  successful: string;
  failed: string;
  pending: string;
  running: string;
  canceled: string;
}

interface AvgDurationRawResult {
  avgDuration: string | null;
}

interface TrendRawResult {
  date: string;
  count: string;
  successful: string;
  failed: string;
}

interface TopProjectRawResult {
  projectId: string;
  projectName: string;
  deploymentCount: string;
  successCount: string;
}

interface EnvironmentStatsRawResult {
  environment: string;
  count: string;
  successCount: string;
}

interface ProjectStatsRawResult {
  total: string;
  successful: string;
  failed: string;
}

interface CountRawResult {
  count: string;
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
    if (filterDto.project_id) {
      queryBuilder.where('deployment.project_id = :projectId', {
        projectId: filterDto.project_id,
      });
    }

    // Apply optional filters
    if (filterDto.owner_id) {
      queryBuilder.andWhere('deployment.owner_id = :ownerId', {
        ownerId: filterDto.owner_id,
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

  // ========================================
  // STATISTICS METHODS
  // ========================================

  /**
   * Get deployment statistics by owner within a date range
   */
  async getStatsByOwner(
    ownerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    running: number;
    canceled: number;
  }> {
    const query = this.repository
      .createQueryBuilder('deployment')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.SUCCESS}' THEN 1 END)`,
        'successful',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.FAILED}' THEN 1 END)`,
        'failed',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.PENDING}' THEN 1 END)`,
        'pending',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.RUNNING}' THEN 1 END)`,
        'running',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.CANCELED}' THEN 1 END)`,
        'canceled',
      )
      .where('deployment.owner_id = :ownerId', { ownerId });

    if (startDate) {
      query.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const result = await query.getRawOne<StatsRawResult>();
    return {
      total: parseInt(result?.total ?? '0', 10),
      successful: parseInt(result?.successful ?? '0', 10),
      failed: parseInt(result?.failed ?? '0', 10),
      pending: parseInt(result?.pending ?? '0', 10),
      running: parseInt(result?.running ?? '0', 10),
      canceled: parseInt(result?.canceled ?? '0', 10),
    };
  }

  /**
   * Get average deployment duration for completed deployments
   */
  async getAvgDuration(ownerId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const query = this.repository
      .createQueryBuilder('deployment')
      .select(
        'AVG(EXTRACT(EPOCH FROM (deployment.completed_at - deployment.created_at)))',
        'avgDuration',
      )
      .where('deployment.owner_id = :ownerId', { ownerId })
      .andWhere('deployment.status = :status', { status: DeploymentStatus.SUCCESS })
      .andWhere('deployment.completed_at IS NOT NULL');

    if (startDate) {
      query.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const result = await query.getRawOne<AvgDurationRawResult>();
    return parseFloat(result?.avgDuration ?? '0') || 0;
  }

  /**
   * Get deployment trends over time (daily/weekly/monthly counts)
   */
  async getDeploymentTrends(
    ownerId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<{ date: string; count: number; successful: number; failed: number }[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-IW'; // ISO week
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const query = this.repository
      .createQueryBuilder('deployment')
      .select(`TO_CHAR(deployment.created_at, '${dateFormat}')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.SUCCESS}' THEN 1 END)`,
        'successful',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.FAILED}' THEN 1 END)`,
        'failed',
      )
      .where('deployment.owner_id = :ownerId', { ownerId })
      .andWhere('deployment.created_at >= :startDate', { startDate })
      .andWhere('deployment.created_at <= :endDate', { endDate })
      .groupBy(`TO_CHAR(deployment.created_at, '${dateFormat}')`)
      .orderBy('date', 'ASC');

    const results = await query.getRawMany<TrendRawResult>();
    return results.map(r => ({
      date: r.date,
      count: parseInt(r.count, 10) || 0,
      successful: parseInt(r.successful, 10) || 0,
      failed: parseInt(r.failed, 10) || 0,
    }));
  }

  /**
   * Get top projects by deployment count
   */
  async getTopProjectsByDeployments(
    ownerId: string,
    limit = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      deploymentCount: number;
      successCount: number;
    }[]
  > {
    const query = this.repository
      .createQueryBuilder('deployment')
      .leftJoin('deployment.project', 'project')
      .select('deployment.project_id', 'projectId')
      .addSelect('project.name', 'projectName')
      .addSelect('COUNT(*)', 'deploymentCount')
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.SUCCESS}' THEN 1 END)`,
        'successCount',
      )
      .where('deployment.owner_id = :ownerId', { ownerId })
      .groupBy('deployment.project_id')
      .addGroupBy('project.name')
      .orderBy('"deploymentCount"', 'DESC')
      .limit(limit);

    if (startDate) {
      query.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const results = await query.getRawMany<TopProjectRawResult>();
    return results.map(r => ({
      projectId: r.projectId,
      projectName: r.projectName,
      deploymentCount: parseInt(r.deploymentCount, 10) || 0,
      successCount: parseInt(r.successCount, 10) || 0,
    }));
  }

  /**
   * Get deployment stats by environment
   */
  async getStatsByEnvironment(
    ownerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ environment: string; count: number; successCount: number }[]> {
    const query = this.repository
      .createQueryBuilder('deployment')
      .select('deployment.environment', 'environment')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.SUCCESS}' THEN 1 END)`,
        'successCount',
      )
      .where('deployment.owner_id = :ownerId', { ownerId })
      .groupBy('deployment.environment');

    if (startDate) {
      query.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const results = await query.getRawMany<EnvironmentStatsRawResult>();
    return results.map(r => ({
      environment: r.environment,
      count: parseInt(r.count, 10) || 0,
      successCount: parseInt(r.successCount, 10) || 0,
    }));
  }

  /**
   * Get recent deployments for activity feed
   */
  getRecentDeployments(ownerId: string, limit = 10): Promise<Deployment[]> {
    return this.repository.find({
      where: { owner_id: ownerId },
      relations: ['project'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get deployment count for a specific project
   */
  async getProjectDeploymentStats(
    projectId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  }> {
    const statsQuery = this.repository
      .createQueryBuilder('deployment')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.SUCCESS}' THEN 1 END)`,
        'successful',
      )
      .addSelect(
        `COUNT(CASE WHEN deployment.status = '${DeploymentStatus.FAILED}' THEN 1 END)`,
        'failed',
      )
      .where('deployment.project_id = :projectId', { projectId });

    if (startDate) {
      statsQuery.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      statsQuery.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const stats = await statsQuery.getRawOne<ProjectStatsRawResult>();

    // Get average duration separately
    const durationQuery = this.repository
      .createQueryBuilder('deployment')
      .select(
        'AVG(EXTRACT(EPOCH FROM (deployment.completed_at - deployment.created_at)))',
        'avgDuration',
      )
      .where('deployment.project_id = :projectId', { projectId })
      .andWhere('deployment.status = :status', { status: DeploymentStatus.SUCCESS })
      .andWhere('deployment.completed_at IS NOT NULL');

    if (startDate) {
      durationQuery.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      durationQuery.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const duration = await durationQuery.getRawOne<AvgDurationRawResult>();

    return {
      total: parseInt(stats?.total ?? '0', 10),
      successful: parseInt(stats?.successful ?? '0', 10),
      failed: parseInt(stats?.failed ?? '0', 10),
      avgDuration: parseFloat(duration?.avgDuration ?? '0') || 0,
    };
  }

  /**
   * Count unique projects with deployments in a period
   */
  async countActiveProjects(ownerId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const query = this.repository
      .createQueryBuilder('deployment')
      .select('COUNT(DISTINCT deployment.project_id)', 'count')
      .where('deployment.owner_id = :ownerId', { ownerId });

    if (startDate) {
      query.andWhere('deployment.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('deployment.created_at <= :endDate', { endDate });
    }

    const result = await query.getRawOne<CountRawResult>();
    return parseInt(result?.count ?? '0', 10);
  }
}
