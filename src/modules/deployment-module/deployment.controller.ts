import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { Controller, Post, Body, Logger, Get, Param, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
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

  @Get('project/:projectId')
  async getProjectDeployments(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    // Verify project ownership
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new ForbiddenException('Project not found');
    }
    if (project.ownerId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this project');
    }

    // Get deployments for the project
    return this.deploymentService.getProjectDeployments(projectId);
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
