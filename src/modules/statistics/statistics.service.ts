import { DeploymentService } from '@app/modules/deployments/deployment.service';
import { LicenseService } from '@app/modules/license/services/license.service';
import { UserLicenseService } from '@app/modules/license/services/user-license.service';
import { OrderService } from '@app/modules/order/services/order.service';
import { ProjectService } from '@app/modules/projects/services/project.service';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import {
  DashboardStatsDto,
  DeploymentStatsDto,
  DeploymentTrendDto,
  EnvironmentStatsDto,
  LicenseStatsDto,
  ProjectStatsDto,
  RecentOrderDto,
  SalesStatsDto,
  SalesTrendDto,
  StatsPeriod,
  TopSellingLicenseDto,
  UserStatsDto,
} from './dto/statistics.dto';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    @Inject(forwardRef(() => DeploymentService))
    private readonly deploymentService: DeploymentService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly licenseService: LicenseService,
    private readonly userLicenseService: UserLicenseService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  /**
   * Calculate date range based on period
   */
  private getDateRange(period: StatsPeriod): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    // Set endDate to end of day to include all deployments from today
    endDate.setHours(23, 59, 59, 999);
    let startDate: Date;

    switch (period) {
      case StatsPeriod.TODAY:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case StatsPeriod.WEEK:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case StatsPeriod.MONTH:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case StatsPeriod.YEAR:
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
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

    const stats = await this.deploymentService.getStatsByOwner(
      ownerId,
      dateRange.startDate,
      dateRange.endDate,
    );

    const avgDuration = await this.deploymentService.getAvgDuration(
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

    return this.deploymentService.getDeploymentTrends(ownerId, startDate, endDate, groupBy);
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
    const total = await this.projectService.countByOwner(ownerId);

    // Get active projects (with deployments in period)
    const activeWithDeployments = await this.deploymentService.countActiveProjects(
      ownerId,
      startDate,
      endDate,
    );

    // Get top projects by deployments
    const topProjectsRaw = await this.deploymentService.getTopProjectsByDeployments(
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
    // Get all licenses for owner's projects using the license service
    const licenses = await this.licenseService.getLicensesByOwnerProjects(ownerId);
    const licenseIds = licenses.map(l => l.id);

    // Get user licenses (sold licenses) using the user license service
    const userLicenses = await this.userLicenseService.getUserLicensesByLicenseIds(licenseIds);

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

    const stats = await this.deploymentService.getStatsByEnvironment(ownerId, startDate, endDate);

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

    const { startDate, endDate } = this.getDateRange(period);

    const [
      deployments,
      projects,
      licenses,
      deploymentTrends,
      recentDeployments,
      salesAnalytics,
      salesTrends,
      recentOrders,
    ] = await Promise.all([
      this.getDeploymentStats(ownerId, period),
      this.getProjectStats(ownerId, period),
      this.getLicenseStats(ownerId),
      this.getDeploymentTrends(ownerId, period),
      this.deploymentService.getRecentDeployments(ownerId, 10),
      this.getSalesStats(ownerId, startDate, endDate),
      this.getSalesTrends(ownerId, period),
      this.getRecentOrders(ownerId, 5),
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
      sales: salesAnalytics,
      deploymentTrends,
      salesTrends,
      recentActivity,
      recentOrders,
    };
  }

  /**
   * Get sales statistics for an owner
   */
  async getSalesStats(ownerId: string, startDate?: Date, endDate?: Date): Promise<SalesStatsDto> {
    try {
      const analytics = (await this.orderService.getSalesAnalytics(
        ownerId,
        startDate,
        endDate,
      )) as {
        totalOrders: number;
        completedOrders: number;
        pendingOrders: number;
        failedOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        conversionRate: number;
      };
      return {
        totalOrders: analytics.totalOrders,
        completedOrders: analytics.completedOrders,
        pendingOrders: analytics.pendingOrders,
        failedOrders: analytics.failedOrders,
        totalRevenue: analytics.totalRevenue,
        averageOrderValue: analytics.averageOrderValue,
        conversionRate: analytics.conversionRate,
      };
    } catch (error) {
      this.logger.error(
        `Error getting sales stats for owner ${ownerId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        failedOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        conversionRate: 0,
      };
    }
  }

  /**
   * Get sales trends over time for an owner
   */
  async getSalesTrends(
    ownerId: string,
    period: StatsPeriod = StatsPeriod.MONTH,
  ): Promise<SalesTrendDto[]> {
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

    try {
      const trends = (await this.orderService.getSalesTrends(
        ownerId,
        startDate,
        endDate,
        groupBy,
      )) as {
        date: string;
        orderCount: number;
        revenue: number;
      }[];
      return trends.map(t => ({
        date: t.date,
        orderCount: t.orderCount,
        revenue: t.revenue,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting sales trends for owner ${ownerId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get top selling licenses for an owner
   */
  async getTopSellingLicenses(
    ownerId: string,
    limit: number = 5,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopSellingLicenseDto[]> {
    try {
      return (await this.orderService.getTopSellingLicenses(
        ownerId,
        limit,
        startDate,
        endDate,
      )) as TopSellingLicenseDto[];
    } catch (error) {
      this.logger.error(
        `Error getting top selling licenses for owner ${ownerId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get recent orders for an owner
   */
  async getRecentOrders(ownerId: string, limit: number = 10): Promise<RecentOrderDto[]> {
    try {
      const orders = (await this.orderService.getRecentOrdersByOwner(ownerId, limit)) as Array<{
        id: string;
        user?: { first_name?: string; last_name?: string };
        billing?: { first_name: string; last_name?: string };
        license?: { name: string };
        amount: number;
        currency: string;
        status: string;
        created_at: Date;
      }>;
      return orders.map(order => ({
        id: order.id,
        buyerName: order.user?.first_name
          ? `${order.user.first_name} ${order.user.last_name || ''}`.trim()
          : order.billing?.first_name
            ? `${order.billing.first_name} ${order.billing.last_name || ''}`.trim()
            : 'Unknown',
        licenseName: order.license?.name || 'Unknown License',
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        createdAt: order.created_at,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting recent orders for owner ${ownerId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get user-specific statistics (for license buyers)
   */
  async getUserStats(userId: string): Promise<UserStatsDto> {
    // Get user's licenses using the user license service
    const userLicenses = await this.userLicenseService.findAllByOwner(userId);

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

    const stats = await this.deploymentService.getProjectDeploymentStats(
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
    try {
      const project = await this.projectService.findOne(projectId);
      return project.owner_id === userId;
    } catch {
      return false;
    }
  }
}
