import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { UserLicenseService } from '@app/modules/license/services/user-license.service';
import {
  Controller,
  Post,
  Body,
  Logger,
  Get,
  Param,
  ForbiddenException,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Pagination } from 'nestjs-typeorm-paginate';

import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentCountDto } from './dto/filter-deployment-count.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { RedeployDeploymentDto } from './dto/redeploy-deployment.dto';
import { Deployment } from './entities/deployment.entity';
import { DeploymentOrchestratorService } from './services/deployment-orchestrator.service';
import {
  ApiCancelDeployment,
  ApiCreateDeployment,
  ApiGetDeployment,
  ApiGetDeploymentLogs,
  ApiGetDeployments,
  ApiGetUserLicenses,
  ApiRedeployDeployment,
  ApiRetryDeployment,
} from './swagger';
import { UserLicense } from '../license/entities/user-license.entity';
import { User } from '../users/entities/user.entity';

@Controller('deployments')
@Authenticated()
export class DeploymentController {
  private readonly logger = new Logger(DeploymentController.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly deploymentOrchestratorService: DeploymentOrchestratorService,
    private readonly userLicenseService: UserLicenseService,
  ) {}

  @Post()
  @ApiCreateDeployment()
  createDeployment(@Body() createDeploymentDto: CreateDeploymentDto, @CurrentUser() user: User) {
    return this.deploymentOrchestratorService.createDeployment(createDeploymentDto, user);
  }

  @Get('monthly-usage')
  getMonthlyDeploymentUsage(@CurrentUser() user: User) {
    return this.deploymentService.getMonthlyDeploymentUsage(user.id);
  }

  @Get(':deploymentId')
  @ApiGetDeployment()
  async getDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return deployment;
  }

  @Post(':deploymentId/retry')
  @ApiRetryDeployment()
  async retryDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to retry this deployment');
    }

    return this.deploymentService.retryDeployment(deploymentId);
  }

  @Post(':deploymentId/cancel')
  @ApiCancelDeployment()
  cancelDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    return this.deploymentService.cancelDeployment(deploymentId, user.id);
  }

  @Post(':deploymentId/redeploy')
  @ApiRedeployDeployment()
  redeployDeployment(
    @Param('deploymentId') deploymentId: string,
    @Body() redeployDto: RedeployDeploymentDto,
    @CurrentUser() user: User,
  ) {
    return this.deploymentService.redeployDeployment(
      deploymentId,
      {
        environment: redeployDto.environment,
        branch: redeployDto.branch,
        environmentVariables: redeployDto.environmentVariables,
      },
      user,
    );
  }

  @Get()
  @ApiGetDeployments()
  getDeployments(
    @Query() filterDto: FilterDeploymentDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user: User,
  ): Promise<Pagination<Deployment>> {
    return this.deploymentService.getDeployments(
      {
        ...filterDto,
        owner_id: user.id,
      },
      {
        page,
        limit,
        route: 'deployments',
      },
    );
  }

  @Get(':deploymentId/logs')
  @ApiGetDeploymentLogs()
  async getDeploymentLogs(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return this.deploymentService.getDeploymentLogs(deployment);
  }

  @Get('licenses')
  @ApiGetUserLicenses()
  getUserLicenses(
    @Query() filterDto: FilterDeploymentCountDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user: User,
  ): Promise<Pagination<UserLicense>> {
    return this.userLicenseService.getAllUserLicenses(
      { page, limit, route: 'deployments/licenses' },
      {
        owner_id: user.id,
        license_id: filterDto.licenseId,
      },
    );
  }
}
