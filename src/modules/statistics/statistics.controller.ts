import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  DashboardStatsDto,
  DeploymentStatsDto,
  DeploymentTrendDto,
  EnvironmentStatsDto,
  LicenseStatsDto,
  ProjectStatsDto,
  StatsQueryDto,
  UserStatsDto,
} from './dto/statistics.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics')
@Controller('statistics')
@Authenticated()
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Returns comprehensive statistics for the owner dashboard including deployments, projects, licenses, and trends.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  getDashboardStats(
    @CurrentUser() user: User,
    @Query() query: StatsQueryDto,
  ): Promise<DashboardStatsDto> {
    return this.statisticsService.getDashboardStats(user.id, query.period);
  }

  @Get('deployments')
  @ApiOperation({
    summary: 'Get deployment statistics',
    description:
      'Returns deployment statistics including counts by status, success rate, and average duration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deployment statistics retrieved successfully',
    type: DeploymentStatsDto,
  })
  getDeploymentStats(
    @CurrentUser() user: User,
    @Query() query: StatsQueryDto,
  ): Promise<DeploymentStatsDto> {
    return this.statisticsService.getDeploymentStats(user.id, query.period);
  }

  @Get('deployments/trends')
  @ApiOperation({
    summary: 'Get deployment trends',
    description: 'Returns deployment trends over time grouped by day, week, or month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deployment trends retrieved successfully',
    type: [DeploymentTrendDto],
  })
  getDeploymentTrends(
    @CurrentUser() user: User,
    @Query() query: StatsQueryDto,
  ): Promise<DeploymentTrendDto[]> {
    return this.statisticsService.getDeploymentTrends(user.id, query.period);
  }

  @Get('deployments/environments')
  @ApiOperation({
    summary: 'Get deployment statistics by environment',
    description:
      'Returns deployment statistics grouped by environment (production, preview, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Environment statistics retrieved successfully',
    type: [EnvironmentStatsDto],
  })
  getEnvironmentStats(
    @CurrentUser() user: User,
    @Query() query: StatsQueryDto,
  ): Promise<EnvironmentStatsDto[]> {
    return this.statisticsService.getEnvironmentStats(user.id, query.period);
  }

  @Get('projects')
  @ApiOperation({
    summary: 'Get project statistics',
    description:
      'Returns project statistics including total count, active projects, and top projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project statistics retrieved successfully',
    type: ProjectStatsDto,
  })
  getProjectStats(
    @CurrentUser() user: User,
    @Query() query: StatsQueryDto,
  ): Promise<ProjectStatsDto> {
    return this.statisticsService.getProjectStats(user.id, query.period);
  }

  @Get('projects/:projectId')
  @ApiOperation({
    summary: 'Get statistics for a specific project',
    description: 'Returns deployment statistics for a specific project.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project deployment statistics retrieved successfully',
  })
  getProjectDeploymentStats(
    @Param('projectId') projectId: string,
    @Query() query: StatsQueryDto,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDurationSeconds: number;
  }> {
    return this.statisticsService.getProjectDeploymentStats(projectId, query.period);
  }

  @Get('licenses')
  @ApiOperation({
    summary: 'Get license statistics',
    description: 'Returns license statistics including total sold, active licenses, and revenue.',
  })
  @ApiResponse({
    status: 200,
    description: 'License statistics retrieved successfully',
    type: LicenseStatsDto,
  })
  getLicenseStats(@CurrentUser() user: User): Promise<LicenseStatsDto> {
    return this.statisticsService.getLicenseStats(user.id);
  }

  @Get('user')
  @ApiOperation({
    summary: 'Get user statistics',
    description:
      'Returns statistics for a license buyer including their deployments and license usage.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsDto,
  })
  getUserStats(@CurrentUser() user: User): Promise<UserStatsDto> {
    return this.statisticsService.getUserStats(user.id);
  }
}
