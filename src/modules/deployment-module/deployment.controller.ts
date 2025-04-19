import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
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
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { Deployment } from './entities/deployment.entity';
import { ProjectConfiguration } from '../projects/entities/project-configuration.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';

@Controller('deployments')
@Authenticated()
export class DeploymentController {
  private readonly logger = new Logger(DeploymentController.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectConfiguration)
    private projectConfigurationRepository: Repository<ProjectConfiguration>,
  ) {}

  @Post()
  async createDeployment(
    @Body() createDeploymentDto: CreateDeploymentDto,
    @CurrentUser() user: User,
  ) {
    const project = await this.projectRepository.findOne({
      where: { id: createDeploymentDto.projectId },
    });
    if (!project) {
      throw new ForbiddenException('Project not found');
    }
    const configuration = await this.projectConfigurationRepository.findOne({
      where: { id: createDeploymentDto.configurationId },
    });
    if (!configuration) {
      throw new ForbiddenException('Configuration not found');
    }

    // Verify project ownership
    if (project.ownerId !== user.id) {
      throw new ForbiddenException('You do not have permission to deploy this project');
    }

    this.logger.log(
      `Received deployment request for project ${project.id} with configuration ${configuration.id}`,
    );

    return this.deploymentService.createDeployment(
      {
        ...createDeploymentDto,
        ownerId: user.id,
      },
      project,
      configuration,
    );
  }

  @Get(':deploymentId')
  async getDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    // Load deployment
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    // Verify ownership
    if (deployment.ownerId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return deployment;
  }

  @Post(':deploymentId/retry')
  async retryDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    // Load deployment
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    // Verify ownership
    if (deployment.ownerId !== user.id) {
      throw new ForbiddenException('You do not have permission to retry this deployment');
    }

    return this.deploymentService.retryDeployment(deploymentId);
  }

  @Get()
  @ApiOperation({ summary: 'Get deployments with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'environment', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'branch', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return paginated deployments' })
  getDeployments(
    @Query() filterDto: FilterDeploymentDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    // @CurrentUser() user: User,
  ): Promise<Pagination<Deployment>> {
    // For non-admin users, force filter by their own ID
    // if (!user.isAdmin) {
    //   filterDto.ownerId = user.id;
    // }

    // Verify project access
    // const project = await this.projectRepository.findOne({
    //   where: { id: filterDto.projectId },
    // });

    // if (!project) {
    //   throw new ForbiddenException('Project not found');
    // }

    // Non-admin users can only access their own projects
    // if (!user.isAdmin && project.ownerId !== user.id) {
    //   throw new ForbiddenException('You do not have permission to access this project');
    // }

    return this.deploymentService.getDeployments(filterDto, {
      page,
      limit,
      route: 'deployments',
    });
  }

  @Get(':deploymentId/logs')
  async getDeploymentLogs(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    // Load deployment
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    // Verify ownership
    if (deployment.ownerId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return this.deploymentService.getDeploymentLogs(deploymentId);
  }
}
