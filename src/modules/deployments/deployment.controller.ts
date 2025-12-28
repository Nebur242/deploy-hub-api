import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Authenticated } from '@app/core/guards/roles-auth.guard';
import { LicenseService } from '@app/modules/license/services/license.service';
import { UserLicenseService } from '@app/modules/license/services/user-license.service';
import { ProjectConfigurationService } from '@app/modules/project-config/services/project-configuration.service';
import { ProjectService } from '@app/modules/projects/services/project.service';
import { SubscriptionService } from '@app/modules/subscription/services/subscription.service';
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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';
import { v4 as uuidv4 } from 'uuid';

import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto, ServiceCreateDeploymentDto } from './dto/create-deployment.dto';
import { FilterDeploymentCountDto } from './dto/filter-deployment-count.dto';
import { FilterDeploymentDto } from './dto/filter.dto';
import { RedeployDeploymentDto } from './dto/redeploy-deployment.dto';
import { Deployment } from './entities/deployment.entity';
import { NetlifyService } from './services/netlify.service';
import { VercelService } from './services/vercel.service';
import { CreateDeploymentContext, DeploymentEntities } from './types/deployment.types';
import { UserLicense } from '../license/entities/user-license.entity';
import {
  EnvironmentVariableDto,
  EnvironmentVariableType,
} from '../project-config/dto/create-project-configuration.dto';
import { DeploymentProvider } from '../project-config/entities/project-configuration.entity';
import { User } from '../users/entities/user.entity';

@Controller('deployments')
@Authenticated()
export class DeploymentController {
  private readonly logger = new Logger(DeploymentController.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly projectService: ProjectService,
    private readonly projectConfigurationService: ProjectConfigurationService,
    private readonly vercelService: VercelService,
    private readonly netlifyService: NetlifyService,
    private readonly licenseService: LicenseService,
    private readonly userLicenseService: UserLicenseService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  async createDeployment(
    @Body() createDeploymentDto: CreateDeploymentDto,
    @CurrentUser() user: User,
  ) {
    try {
      // Load and validate all required entities
      const entities = await this.loadAndValidateEntities(createDeploymentDto);

      // Create deployment context
      const context: CreateDeploymentContext = {
        dto: createDeploymentDto,
        user,
        entities,
      };

      this.logger.log(
        `Processing deployment request for project ${entities.project.id} with configuration ${entities.configuration.id}`,
      );

      // Check deployment limits (both license and subscription)
      await this.validateDeploymentLimits(context);

      // Process deployment based on provider
      const deployment = await this.processDeploymentByProvider(context);

      // Increment subscription deployment count for project owners
      if (entities.project.owner_id === user.id && !createDeploymentDto.isTest) {
        await this.subscriptionService.incrementDeploymentCount(user.id);
      }

      return deployment;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      this.logger.error(`Deployment creation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Load and validate all required entities using their services
   */
  private async loadAndValidateEntities(dto: CreateDeploymentDto): Promise<DeploymentEntities> {
    // Load entities in parallel using their respective services
    const [project, configuration, license, userLicense] = await Promise.all([
      this.projectService.findOne(dto.projectId).catch(() => null),
      this.projectConfigurationService.findOne(dto.configurationId).catch(() => null),
      this.licenseService.findOne(dto.licenseId).catch(() => null),
      dto.userLicenseId
        ? this.userLicenseService.getUserLicenseById(dto.userLicenseId).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!configuration) {
      throw new NotFoundException('Configuration not found');
    }

    if (!license) {
      throw new NotFoundException('License not found');
    }

    // User license is optional for project owners
    return { project, configuration, license, userLicense };
  }

  /**
   * Validate deployment limits for the user
   * Project owners are subject to subscription limits
   * Non-owners are subject to license limits
   * Test deployments don't consume any limits
   */
  private async validateDeploymentLimits(context: CreateDeploymentContext): Promise<void> {
    const { dto, user, entities } = context;

    // Test deployments don't consume any limits
    if (dto.isTest) {
      this.logger.log(
        `Test deployment requested for project ${entities.project.id}. Bypassing deployment limit checks.`,
      );
      return;
    }

    // Check if the user is the project owner
    if (entities.project.owner_id === user.id) {
      this.logger.log(
        `User ${user.id} is the project owner for project ${entities.project.id}. Checking subscription limits.`,
      );

      // Project owners are subject to subscription deployment limits
      await this.subscriptionService.validateDeployment(user.id);
      return;
    }

    // Non-owners are subject to license limits
    // Find active UserLicense for this user and license using service
    const userLicense = await this.userLicenseService.findActiveUserLicense(dto.licenseId, user.id);

    if (!userLicense) {
      throw new ForbiddenException('No active license found for this deployment');
    }

    const hasAvailable = await this.userLicenseService.hasAvailableDeployments(userLicense.id);
    if (!hasAvailable) {
      throw new ForbiddenException('Maximum deployments limit reached');
    }
  }

  /**
   * Process deployment based on the configured provider
   */
  private processDeploymentByProvider(context: CreateDeploymentContext) {
    const { entities } = context;
    const provider = entities.configuration.deployment_option.provider;

    switch (provider) {
      case DeploymentProvider.VERCEL:
        return this.handleVercelDeployment(context);

      case DeploymentProvider.NETLIFY:
        return this.handleNetlifyDeployment(context);

      default:
        return this.handleDefaultDeployment(context);
    }
  }

  /**
   * Handle Vercel deployment creation
   */
  private async handleVercelDeployment(context: CreateDeploymentContext) {
    const { dto } = context;

    // Validate required environment variables
    const tokenVar = this.getRequiredEnvVar(dto.environmentVariables, 'VERCEL_TOKEN');
    const orgIdVar = this.getRequiredEnvVar(dto.environmentVariables, 'VERCEL_ORG_ID');

    try {
      // Create Vercel project
      const vercelProject = await this.vercelService.createProject({
        orgId: orgIdVar.default_value,
        token: tokenVar.default_value,
      });

      if (!vercelProject) {
        throw new BadRequestException('Failed to create Vercel project');
      }

      // Update environment variables with project ID
      const updatedEnvVars = this.updateEnvironmentVariable(
        dto.environmentVariables,
        'VERCEL_PROJECT_ID',
        vercelProject.id,
      );

      return await this.createFinalDeployment(context, {
        environmentVariables: updatedEnvVars,
        siteId: vercelProject.id,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      this.logger.error(`Vercel deployment failed: ${error.message}`);
      throw new BadRequestException(`Failed to create Vercel deployment: ${error.message}`);
    }
  }

  /**
   * Handle Netlify deployment creation
   */
  private async handleNetlifyDeployment(context: CreateDeploymentContext) {
    const { dto } = context;

    // Validate required environment variables
    const tokenVar = this.getRequiredEnvVar(dto.environmentVariables, 'NETLIFY_TOKEN');

    try {
      // Create Netlify site
      const netlifySite = await this.netlifyService.createSite({
        token: tokenVar.default_value,
      });

      if (!netlifySite) {
        throw new BadRequestException('Failed to create Netlify site');
      }

      // Update environment variables with site info
      let updatedEnvVars = this.updateOrAddEnvironmentVariable(
        dto.environmentVariables,
        'NETLIFY_SITE_NAME',
        netlifySite.name,
        'Netlify site name',
      );

      updatedEnvVars = this.updateOrAddEnvironmentVariable(
        updatedEnvVars,
        'NETLIFY_SITE_ID',
        netlifySite.site_id,
        'Netlify site ID',
      );

      return await this.createFinalDeployment(context, {
        environmentVariables: updatedEnvVars,
        siteId: netlifySite.site_id,
        deploymentUrl: netlifySite.url,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      this.logger.error(`Netlify deployment failed: ${error.message}`);
      throw new BadRequestException(`Failed to create Netlify deployment: ${error.message}`);
    }
  }

  /**
   * Handle default deployment creation (no specific provider)
   */
  private handleDefaultDeployment(context: CreateDeploymentContext) {
    return this.createFinalDeployment(context, {
      environmentVariables: context.dto.environmentVariables,
      siteId: uuidv4(),
    });
  }

  /**
   * Create the final deployment with all processed data
   */
  private createFinalDeployment(
    context: CreateDeploymentContext,
    overrides: Partial<CreateDeploymentDto & { siteId: string; deploymentUrl?: string }>,
  ) {
    const { dto, user, entities } = context;

    // Ensure siteId is never undefined by using null as fallback
    const deploymentData: ServiceCreateDeploymentDto & { owner: User } = {
      ...dto,
      ownerId: user.id,
      owner: user,
      ...overrides,
      siteId: overrides.siteId || null,
    };

    return this.deploymentService.createDeployment(deploymentData, entities);
  }

  /**
   * Get required environment variable or throw error
   */
  private getRequiredEnvVar(envVars: EnvironmentVariableDto[], key: string) {
    const envVar = envVars.find(env => env.key === key);
    if (!envVar) {
      throw new BadRequestException(`${key} is required for this deployment type`);
    }
    return envVar;
  }

  /**
   * Update existing environment variable value
   */
  private updateEnvironmentVariable(envVars: EnvironmentVariableDto[], key: string, value: string) {
    return envVars.map(env => (env.key === key ? { ...env, default_value: value } : env));
  }

  /**
   * Update existing environment variable or add new one
   */
  private updateOrAddEnvironmentVariable(
    envVars: EnvironmentVariableDto[],
    key: string,
    value: string,
    description: string,
  ) {
    const existingIndex = envVars.findIndex(env => env.key === key);
    const updatedEnvVars = [...envVars];

    if (existingIndex >= 0) {
      updatedEnvVars[existingIndex] = {
        ...updatedEnvVars[existingIndex],
        default_value: value,
      };
    } else {
      updatedEnvVars.push({
        key,
        default_value: value,
        description,
        is_required: true,
        is_secret: false,
        type: EnvironmentVariableType.TEXT,
      });
    }

    return updatedEnvVars;
  }

  @Get(':deploymentId')
  async getDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return deployment;
  }

  @Post(':deploymentId/retry')
  async retryDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to retry this deployment');
    }

    return this.deploymentService.retryDeployment(deploymentId);
  }

  @Post(':deploymentId/cancel')
  @ApiOperation({ summary: 'Cancel a running or pending deployment' })
  @ApiResponse({
    status: 200,
    description: 'Deployment cancellation result',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot cancel deployment or not authorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Deployment not found',
  })
  cancelDeployment(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    return this.deploymentService.cancelDeployment(deploymentId, user.id);
  }

  @Post(':deploymentId/redeploy')
  @ApiOperation({ summary: 'Redeploy an existing deployment with optional overrides' })
  @ApiResponse({
    status: 201,
    description: 'Redeployment created successfully',
    type: Deployment,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input or license limits exceeded',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not authorized to redeploy this deployment',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Original deployment not found',
  })
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
  @ApiOperation({ summary: 'Get deployments with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'environment', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'branch', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return paginated deployments' })
  async getDeployments(
    @Query() filterDto: FilterDeploymentDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user: User,
  ): Promise<Pagination<Deployment>> {
    // Validate project exists using service if projectId provided
    if (filterDto.projectId) {
      try {
        await this.projectService.findOne(filterDto.projectId);
      } catch {
        throw new ForbiddenException('Project not found');
      }
    }

    return this.deploymentService.getDeployments(
      {
        ...filterDto,
        ownerId: user.id,
      },
      {
        page,
        limit,
        route: 'deployments',
      },
    );
  }

  @Get(':deploymentId/logs')
  async getDeploymentLogs(@Param('deploymentId') deploymentId: string, @CurrentUser() user: User) {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (deployment.owner_id !== user.id) {
      throw new ForbiddenException('You do not have permission to access this deployment');
    }

    return this.deploymentService.getDeploymentLogs(deployment);
  }

  @Get('licenses')
  @ApiOperation({ summary: 'Get user licenses with pagination and filters' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'licenseId',
    required: false,
    type: String,
    description: 'Filter by license ID',
  })
  @ApiQuery({
    name: 'createdFrom',
    required: false,
    type: String,
    description: 'Filter by created date (from)',
  })
  @ApiQuery({
    name: 'createdTo',
    required: false,
    type: String,
    description: 'Filter by created date (to)',
  })
  @ApiQuery({
    name: 'minCount',
    required: false,
    type: Number,
    description: 'Filter by minimum deployment count',
  })
  @ApiResponse({ status: 200, description: 'Return paginated user licenses' })
  getUserLicenses(
    @Query() filterDto: FilterDeploymentCountDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user: User,
  ): Promise<Pagination<UserLicense>> {
    // Use UserLicenseService to get user licenses
    return this.userLicenseService.getAllUserLicenses(
      { page, limit, route: 'deployments/licenses' },
      {
        owner_id: user.id,
        license_id: filterDto.licenseId,
      },
    );
  }
}
