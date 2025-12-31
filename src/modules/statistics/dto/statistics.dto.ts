import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum StatsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  ALL_TIME = 'all_time',
}

export class StatsQueryDto {
  @ApiPropertyOptional({
    enum: StatsPeriod,
    default: StatsPeriod.MONTH,
    description: 'Time period for statistics',
  })
  @IsOptional()
  @IsEnum(StatsPeriod)
  period?: StatsPeriod = StatsPeriod.MONTH;

  @ApiPropertyOptional({ description: 'Start date for custom range' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for custom range' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DeploymentStatsDto {
  @ApiProperty({ description: 'Total number of deployments' })
  total: number;

  @ApiProperty({ description: 'Number of successful deployments' })
  successful: number;

  @ApiProperty({ description: 'Number of failed deployments' })
  failed: number;

  @ApiProperty({ description: 'Number of pending deployments' })
  pending: number;

  @ApiProperty({ description: 'Number of running deployments' })
  running: number;

  @ApiProperty({ description: 'Number of canceled deployments' })
  canceled: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Average deployment duration in seconds' })
  avgDurationSeconds: number;
}

export class DeploymentTrendDto {
  @ApiProperty({ description: 'Date label' })
  date: string;

  @ApiProperty({ description: 'Number of deployments' })
  count: number;

  @ApiProperty({ description: 'Number of successful deployments' })
  successful: number;

  @ApiProperty({ description: 'Number of failed deployments' })
  failed: number;
}

export class ProjectStatsDto {
  @ApiProperty({ description: 'Total number of projects' })
  total: number;

  @ApiProperty({ description: 'Number of active projects (with recent deployments)' })
  activeWithDeployments: number;

  @ApiProperty({ description: 'Top projects by deployment count' })
  topProjects: {
    projectId: string;
    projectName: string;
    deploymentCount: number;
    successCount: number;
  }[];
}

export class LicenseStatsDto {
  @ApiProperty({ description: 'Total licenses sold' })
  totalSold: number;

  @ApiProperty({ description: 'Active licenses' })
  activeLicenses: number;

  @ApiProperty({ description: 'Total revenue from licenses' })
  totalRevenue: number;

  @ApiProperty({ description: 'Licenses by project' })
  byProject: {
    projectId: string;
    projectName: string;
    licensesSold: number;
    revenue: number;
  }[];
}

// ===== Sales/Orders Statistics DTOs =====

export class SalesStatsDto {
  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Number of completed orders' })
  completedOrders: number;

  @ApiProperty({ description: 'Number of pending orders' })
  pendingOrders: number;

  @ApiProperty({ description: 'Number of failed orders' })
  failedOrders: number;

  @ApiProperty({ description: 'Total revenue from completed orders' })
  totalRevenue: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Conversion rate (completed/total)' })
  conversionRate: number;
}

export class SalesTrendDto {
  @ApiProperty({ description: 'Date label' })
  date: string;

  @ApiProperty({ description: 'Number of orders' })
  orderCount: number;

  @ApiProperty({ description: 'Revenue for this period' })
  revenue: number;
}

export class TopSellingLicenseDto {
  @ApiProperty({ description: 'License ID' })
  licenseId: string;

  @ApiProperty({ description: 'License name' })
  licenseName: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Project name' })
  projectName: string;

  @ApiProperty({ description: 'Number of orders' })
  orderCount: number;

  @ApiProperty({ description: 'Total revenue' })
  revenue: number;
}

export class RecentOrderDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiProperty({ description: 'Buyer name' })
  buyerName: string;

  @ApiProperty({ description: 'License name' })
  licenseName: string;

  @ApiProperty({ description: 'Order amount' })
  amount: number;

  @ApiProperty({ description: 'Order currency' })
  currency: string;

  @ApiProperty({ description: 'Order status' })
  status: string;

  @ApiProperty({ description: 'Order date' })
  createdAt: Date;
}

// ===== End Sales/Orders Statistics DTOs =====

export class UserStatsDto {
  @ApiProperty({ description: 'User deployment statistics' })
  deployments: DeploymentStatsDto;

  @ApiProperty({ description: 'Number of active licenses owned' })
  activeLicenses: number;

  @ApiProperty({ description: 'Total deployments remaining across all licenses' })
  deploymentsRemaining: number;
}

export class RecentActivityDto {
  @ApiProperty({ description: 'Deployment ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  project_id: string;

  @ApiProperty({ description: 'Project name' })
  projectName: string;

  @ApiProperty({ description: 'Deployment environment' })
  environment: string;

  @ApiProperty({ description: 'Deployment status' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completed_at?: Date;
}

export class DashboardStatsDto {
  @ApiProperty({ description: 'Deployment statistics' })
  deployments: DeploymentStatsDto;

  @ApiProperty({ description: 'Project statistics' })
  projects: ProjectStatsDto;

  @ApiProperty({ description: 'License statistics' })
  licenses: LicenseStatsDto;

  @ApiPropertyOptional({ description: 'Sales statistics' })
  sales?: SalesStatsDto;

  @ApiProperty({ description: 'Deployment trends over time' })
  deploymentTrends: DeploymentTrendDto[];

  @ApiPropertyOptional({ description: 'Sales trends over time' })
  salesTrends?: SalesTrendDto[];

  @ApiProperty({ description: 'Recent deployment activity', type: [RecentActivityDto] })
  recentActivity: RecentActivityDto[];

  @ApiPropertyOptional({ description: 'Recent sales/orders', type: [RecentOrderDto] })
  recentOrders?: RecentOrderDto[];
}

export class EnvironmentStatsDto {
  @ApiProperty({ description: 'Environment name' })
  environment: string;

  @ApiProperty({ description: 'Deployment count' })
  count: number;

  @ApiProperty({ description: 'Success rate' })
  successRate: number;
}

export class ProviderStatsDto {
  @ApiProperty({ description: 'Deployment provider' })
  provider: string;

  @ApiProperty({ description: 'Deployment count' })
  count: number;

  @ApiProperty({ description: 'Success rate' })
  successRate: number;

  @ApiProperty({ description: 'Average duration in seconds' })
  avgDurationSeconds: number;
}
