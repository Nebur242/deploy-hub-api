import { Controller, Post, Body, Get, Param, Query, Logger } from '@nestjs/common';

import { DeploymentService } from './deployment.service';
import { BatchDeploymentDto, CreateDeploymentDto } from './dto/create-deployment.dto';

@Controller('deployments')
export class DeploymentController {
  private readonly logger = new Logger(DeploymentController.name);

  constructor(private readonly deploymentService: DeploymentService) {}

  @Post()
  createDeployment(@Body() createDeploymentDto: CreateDeploymentDto) {
    this.logger.log(`Received deployment request for ${createDeploymentDto.name}`);
    return this.deploymentService.createDeployment(createDeploymentDto);
  }

  @Post('batch')
  batchDeployment(@Body() batchDeploymentDto: BatchDeploymentDto) {
    this.logger.log(
      `Received batch deployment request for ${batchDeploymentDto.deployments.length} users`,
    );
    return this.deploymentService.batchDeployment(batchDeploymentDto.deployments);
  }

  @Get()
  getAllDeployments(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('environment') environment?: string,
  ) {
    return this.deploymentService.getAllDeployments(status, userId, environment);
  }

  @Get(':id')
  getDeployment(@Param('id') id: string) {
    return this.deploymentService.getDeploymentById(id);
  }

  @Post(':id/retry')
  retryDeployment(@Param('id') id: string) {
    return this.deploymentService.retryDeployment(id);
  }

  @Post('production')
  triggerProductionDeployments() {
    return this.deploymentService.triggerEnvironmentDeployments('production');
  }

  @Post('preview')
  triggerPreviewDeployments() {
    return this.deploymentService.triggerEnvironmentDeployments('preview');
  }
}
