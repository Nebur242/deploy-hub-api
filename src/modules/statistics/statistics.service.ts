import { DeploymentRepository } from '@app/modules/deployments/repositories/deployment.repository';
import { License } from '@app/modules/license/entities/license.entity';
import { UserLicense } from '@app/modules/license/entities/user-license.entity';
import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DashboardStatsDto,
  DeploymentStatsDto,
  DeploymentTrendDto,
  EnvironmentStatsDto,
  LicenseStatsDto,
  ProjectStatsDto,
  StatsPeriod,
  UserStatsDto,
} from './dto/statistics.dto';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly projectRepository: ProjectRepository,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
  ) {}

  /**
   * Calculate date range based on period
   */
  private getDateRange(period: StatsPeriod): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case StatsPeriod.TODAY:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case StatsPeriod.WEEK:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case StatsPeriod.MONTH:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case StatsPeriod.YEAR:
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case StatsPeriod.ALL_TIME:
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Get deployment statistics for an owner
   */
  async getDeploymentStats(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeploymentStatsDto> {
    const dateRange = startDate && endDate ? { startDate, endDate } : this.getDateRange(period);

    const stats = await this.deploymentRepository.getStatsByOwner(
      ownerId,
      dateRange.startDate,
      dateRange.endDate,
    );

    const avgDuration = await this.deploymentRepository.getAvgDuration(
      ownerId,
      dateRange.startDate,
      dateRange.endDate,
    );

    const completedDeployments = stats.successful + stats.failed;
    const successRate =
      completedDeployments > 0
        ? Math.round((stats.successful / completedDeployments) * 100 * 100) / 100
        : 0;

    return {
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      pending: stats.pending,
      running: stats.running,
      canceled: stats.canceled,
      successRate,
      avgDurationSeconds: Math.round(avgDuration),
    };
  }

  /**
   * Get deployment trends over time
   */
  getDeploymentTrends(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<DeploymentTrendDto[]> {
    const { startDate, endDate } = this.getDateRange(period);

    // Determine grouping based on period
    let groupBy: 'day' | 'week' | 'month' = 'day';
    if (period === StatsPeriod.YEAR) {
      groupBy = 'month';
    } else if (period === StatsPeriod.MONTH) {
      groupBy = 'day';
    } else if (period === StatsPeriod.WEEK) {
      groupBy = 'day';
    }

    return this.deploymentRepository.getDeploymentTrends(ownerId, startDate, endDate, groupBy);
  }

  /**
   * Get project statistics for an owner
   */
  async getProjectStats(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<ProjectStatsDto> {
    const { startDate, endDate } = this.getDateRange(period);

    // Get total projects count
    const total = await this.projectRepository.countByOwner(ownerId);

    // Get active projects (with deployments in period)
    const activeWithDeployments = await this.deploymentRepository.countActiveProjects(
      ownerId,
      startDate,
      endDate,
    );

    // Get top projects by deployments
    const topProjectsRaw = await this.deploymentRepository.getTopProjectsByDeployments(
      ownerId,
      5,
      startDate,
      endDate,
    );

    const topProjects = topProjectsRaw.map(p => ({
      projectId: p.projectId,
      projectName: p.projectName || 'Unknown Project',
      deploymentCount: p.deploymentCount,
      successCount: p.successCount,
    }));

    return {
      total,
      activeWithDeployments,
      topProjects,
    };
  }

  /**
   * Get license statistics for an owner
   */
  async getLicenseStats(ownerId: string): Promise<LicenseStatsDto> {
    // Get all licenses for owner's projects
    const licenses = await this.licenseRepository
      .createQueryBuilder('license')
      .leftJoin('license.projects', 'project')
      .where('project.owner_id = :ownerId', { ownerId })
      .getMany();

    const licenseIds = licenses.map(l => l.id);

    // Get user licenses (sold licenses)
    let userLicenses: UserLicense[] = [];
    if (licenseIds.length > 0) {
      userLicenses = await this.userLicenseRepository
        .createQueryBuilder('userLicense')
        .leftJoinAndSelect('userLicense.license', 'license')
        .leftJoinAndSelect('license.projects', 'project')
        .where('userLicense.license_id IN (:...licenseIds)', { licenseIds })
        .getMany();
    }

    // Calculate total revenue
    const totalRevenue = userLicenses.reduce((sum, ul) => {
      return sum + (ul.license?.price || 0);
    }, 0);

    // Group by project
    const byProjectMap = new Map<
      string,
      { projectId: string; projectName: string; licensesSold: number; revenue: number }
    >();

    userLicenses.forEach(ul => {
      // License has ManyToMany with projects, get first project if exists
      const project = ul.license?.projects?.[0];
      const projectId = project?.id || 'unknown';
      const projectName = project?.name || 'Unknown Project';
      const price = ul.license?.price || 0;

      if (!byProjectMap.has(projectId)) {
        byProjectMap.set(projectId, {
          projectId,
          projectName,
          licensesSold: 0,
          revenue: 0,
        });
      }

      const entry = byProjectMap.get(projectId)!;
      entry.licensesSold++;
      entry.revenue += price;
    });

    return {
      totalSold: userLicenses.length,
      activeLicenses: userLicenses.filter(ul => ul.active).length,
      totalRevenue,
      byProject: Array.from(byProjectMap.values()),
    };
  }

  /**
   * Get environment statistics for deployments
   */
  async getEnvironmentStats(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<EnvironmentStatsDto[]> {
    const { startDate, endDate } = this.getDateRange(period);

    const stats = await this.deploymentRepository.getStatsByEnvironment(
      ownerId,
      startDate,
      endDate,
    );

    return stats.map(s => ({
      environment: s.environment,
      count: s.count,
      successRate: s.count > 0 ? Math.round((s.successCount / s.count) * 100 * 100) / 100 : 0,
    }));
  }

  /**
   * Get complete dashboard statistics
   */
  async getDashboardStats(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<DashboardStatsDto> {
    this.logger.log(`Getting dashboard stats for owner ${ownerId}, period: ${period}`);

    const [deployments, projects, licenses, deploymentTrends, recentDeployments] =
      await Promise.all([
        this.getDeploymentStats(ownerId, period),
        this.getProjectStats(ownerId, period),
        this.getLicenseStats(ownerId),
        this.getDeploymentTrends(ownerId, period),
        this.deploymentRepository.getRecentDeployments(ownerId, 10),
      ]);

    // Build recent activity from deployments
    const recentActivity = recentDeployments.map(d => ({
      id: d.id,
      project_id: d.project_id,
      projectName: d.project?.name || 'Unknown Project',
      environment: d.environment || 'unknown',
      status: d.status || 'unknown',
      created_at: d.created_at,
      completed_at: d.completed_at,
    }));

    return {
      deployments,
      projects,
      licenses,
      deploymentTrends,
      recentActivity,
    };
  }

  /**
   * Get user-specific statistics (for license buyers)
   */
  async getUserStats(userId: string): Promise<UserStatsDto> {
    // Get user's licenses (owner_id is the buyer/user who owns the license)
    const userLicenses = await this.userLicenseRepository.find({
      where: { owner_id: userId },
    });

    const activeLicenses = userLicenses.filter(ul => ul.active).length;
    const deploymentsRemaining = userLicenses.reduce((sum, ul) => {
      if (ul.active) {
        return sum + (ul.max_deployments - ul.count);
      }
      return sum;
    }, 0);

    // Get deployment stats for user
    const deploymentStats = await this.getDeploymentStats(userId, StatsPeriod.ALL_TIME);

    return {
      deployments: deploymentStats,
      activeLicenses,
      deploymentsRemaining,
    };
  }

  /**
   * Get statistics for a specific project
   */
  async getProjectDeploymentStats(
    projectId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDurationSeconds: number;
  }> {
    const { startDate, endDate } = this.getDateRange(period);

    const stats = await this.deploymentRepository.getProjectDeploymentStats(
      projectId,
      startDate,
      endDate,
    );

    const completedDeployments = stats.successful + stats.failed;
    const successRate =
      completedDeployments > 0
        ? Math.round((stats.successful / completedDeployments) * 100 * 100) / 100
        : 0;

    return {
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      successRate,
      avgDurationSeconds: Math.round(stats.avgDuration),
    };
  }

  /**
   * Verify that a user has access to a specific project
   * @returns true if user owns the project, false otherwise
   */
  async verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await this.projectRepository.findOne(projectId);
    if (!project) {
      return false;
    }
    return project.owner_id === userId;
  }
}
