import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { NetlifyService } from './netlify.service';
import { VercelService } from './vercel.service';
import { License } from '../../license/entities/license.entity';
import { UserLicense } from '../../license/entities/user-license.entity';
import { LicenseService } from '../../license/services/license.service';
import { UserLicenseService } from '../../license/services/user-license.service';
import {
  EnvironmentVariableDto,
  EnvironmentVariableType,
} from '../../project-config/dto/create-project-configuration.dto';
import {
  DeploymentProvider,
  ProjectConfiguration,
} from '../../project-config/entities/project-configuration.entity';
import { ProjectConfigurationService } from '../../project-config/services/project-configuration.service';
import { Project } from '../../projects/entities/project.entity';
import { ProjectService } from '../../projects/services/project.service';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { User } from '../../users/entities/user.entity';
import { DeploymentService } from '../deployment.service';
import { CreateDeploymentDto, ServiceCreateDeploymentDto } from '../dto/create-deployment.dto';
import { Deployment } from '../entities/deployment.entity';
import { CreateDeploymentContext, DeploymentEntities } from '../types/deployment.types';

/**
 * Result of a provider-specific deployment preparation
 */
interface ProviderDeploymentResult {
  environmentVariables: EnvironmentVariableDto[];
  siteId: string;
  deploymentUrl?: string;
}

/**
 * Orchestrates the deployment creation process
 * Handles entity loading, validation, provider-specific logic, and limit checks
 */
@Injectable()
export class DeploymentOrchestratorService {
  private readonly logger = new Logger(DeploymentOrchestratorService.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly projectService: ProjectService,
    private readonly projectConfigurationService: ProjectConfigurationService,
    private readonly licenseService: LicenseService,
    private readonly userLicenseService: UserLicenseService,
    private readonly subscriptionService: SubscriptionService,
    private readonly vercelService: VercelService,
    private readonly netlifyService: NetlifyService,
  ) {}

  /**
   * Create a deployment with full orchestration
   * Handles entity loading, validation, provider setup, and limit checks
   */
  async createDeployment(dto: CreateDeploymentDto, user: User): Promise<Deployment> {
    this.logger.log(`[DEPLOY] Starting deployment for user ${user.id}`);
    this.logger.log(
      `[DEPLOY] DTO: project_id=${dto.project_id}, config_id=${dto.configuration_id}, env=${dto.environment}, branch=${dto.branch}, is_test=${dto.is_test}`,
    );

    // 1. Load and validate all required entities
    this.logger.log(`[DEPLOY] Step 1: Loading entities...`);
    const entities = await this.loadAndValidateEntities(dto);
    this.logger.log(
      `[DEPLOY] Entities loaded: project=${entities.project.name}, config=${entities.configuration.id}, license=${entities.license?.id || 'none'}`,
    );

    // 2. Create deployment context
    const context: CreateDeploymentContext = { dto, user, entities };

    this.logger.log(
      `[DEPLOY] Step 2: Processing deployment request for project ${entities.project.id} with configuration ${entities.configuration.id}`,
    );

    // 3. Validate deployment limits (license and subscription)
    this.logger.log(`[DEPLOY] Step 3: Validating deployment limits...`);
    await this.validateDeploymentLimits(context);
    this.logger.log(`[DEPLOY] Deployment limits validated`);

    // 4. Process deployment based on provider
    const provider = entities.configuration.deployment_option?.provider || 'github';
    this.logger.log(`[DEPLOY] Step 4: Processing deployment with provider: ${provider}`);
    const deployment = await this.processDeploymentByProvider(context);
    this.logger.log(`[DEPLOY] Deployment created: ${deployment.id}, status=${deployment.status}`);

    // 5. Increment subscription deployment count for project owners (non-test only)
    if (entities.project.owner_id === user.id && !dto.is_test) {
      this.logger.log(`[DEPLOY] Step 5: Incrementing subscription deployment count for owner`);
      await this.subscriptionService.incrementDeploymentCount(user.id);
    }

    this.logger.log(`[DEPLOY] Deployment process completed: ${deployment.id}`);
    return deployment;
  }

  /**
   * Load and validate all required entities
   */
  async loadAndValidateEntities(dto: CreateDeploymentDto): Promise<DeploymentEntities> {
    const [project, configuration, license, userLicense] = await Promise.all([
      this.loadProject(dto.project_id),
      this.loadConfiguration(dto.configuration_id),
      dto.license_id ? this.loadLicense(dto.license_id) : Promise.resolve(null),
      dto.user_license_id ? this.loadUserLicense(dto.user_license_id) : Promise.resolve(null),
    ]);

    return { project, configuration, license, userLicense };
  }

  /**
   * Load project or throw NotFoundException
   */
  private async loadProject(projectId: string): Promise<Project> {
    try {
      const project = await this.projectService.findOne(projectId);
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return project;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Project not found');
    }
  }

  /**
   * Load configuration or throw NotFoundException
   */
  private async loadConfiguration(configurationId: string): Promise<ProjectConfiguration> {
    try {
      const configuration = await this.projectConfigurationService.findOne(configurationId);
      if (!configuration) {
        throw new NotFoundException('Configuration not found');
      }
      return configuration;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Configuration not found');
    }
  }

  /**
   * Load license or throw NotFoundException
   */
  private async loadLicense(licenseId: string): Promise<License> {
    try {
      const license = await this.licenseService.findOne(licenseId);
      if (!license) {
        throw new NotFoundException('License not found');
      }
      return license;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('License not found');
    }
  }

  /**
   * Load user license or return null
   */
  private async loadUserLicense(userLicenseId: string): Promise<UserLicense | null> {
    try {
      return await this.userLicenseService.getUserLicenseById(userLicenseId);
    } catch {
      return null;
    }
  }

  /**
   * Validate deployment limits based on user role
   * - Project owners: subject to subscription limits
   * - Non-owners: subject to license limits
   * - Test deployments: bypass all limits
   */
  async validateDeploymentLimits(context: CreateDeploymentContext): Promise<void> {
    const { dto, user, entities } = context;

    // Test deployments bypass all limits
    if (dto.is_test) {
      this.logger.log(
        `Test deployment requested for project ${entities.project.id}. Bypassing limit checks.`,
      );
      return;
    }

    // Project owners use subscription limits
    if (entities.project.owner_id === user.id) {
      this.logger.log(`User ${user.id} is project owner. Checking subscription limits.`);
      await this.subscriptionService.validateDeployment(user.id);
      return;
    }

    // Non-owners use license limits - require license_id
    if (!dto.license_id) {
      throw new ForbiddenException('License ID is required for non-owner deployments');
    }
    await this.validateLicenseLimits(dto.license_id, user.id);
  }

  /**
   * Validate license limits for non-owner deployments
   */
  private async validateLicenseLimits(licenseId: string, userId: string): Promise<void> {
    const userLicense = await this.userLicenseService.findActiveUserLicense(licenseId, userId);

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
  private processDeploymentByProvider(context: CreateDeploymentContext): Promise<Deployment> {
    const provider = context.entities.configuration.deployment_option.provider;

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
   * Handle Vercel deployment
   */
  private async handleVercelDeployment(context: CreateDeploymentContext): Promise<Deployment> {
    const { dto } = context;

    const tokenVar = this.getRequiredEnvVar(dto.environment_variables, 'VERCEL_TOKEN');
    const orgIdVar = this.getRequiredEnvVar(dto.environment_variables, 'VERCEL_ORG_ID');

    try {
      const vercelProject = await this.vercelService.createProject({
        orgId: orgIdVar.default_value,
        token: tokenVar.default_value,
      });

      if (!vercelProject) {
        throw new BadRequestException('Failed to create Vercel project');
      }

      const updatedEnvVars = this.updateEnvironmentVariable(
        dto.environment_variables,
        'VERCEL_PROJECT_ID',
        vercelProject.id,
      );

      return this.createFinalDeployment(context, {
        environmentVariables: updatedEnvVars,
        siteId: vercelProject.id,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      this.logger.error(`Vercel deployment failed: ${error.message}`);
      throw new BadRequestException(`Failed to create Vercel deployment: ${error.message}`);
    }
  }

  /**
   * Handle Netlify deployment
   */
  private async handleNetlifyDeployment(context: CreateDeploymentContext): Promise<Deployment> {
    const { dto } = context;

    const tokenVar = this.getRequiredEnvVar(dto.environment_variables, 'NETLIFY_TOKEN');

    try {
      const netlifySite = await this.netlifyService.createSite({
        token: tokenVar.default_value,
      });

      if (!netlifySite) {
        throw new BadRequestException('Failed to create Netlify site');
      }

      let updatedEnvVars = this.updateOrAddEnvironmentVariable(
        dto.environment_variables,
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

      return this.createFinalDeployment(context, {
        environmentVariables: updatedEnvVars,
        siteId: netlifySite.site_id,
        deploymentUrl: netlifySite.url,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      this.logger.error(`Netlify deployment failed: ${error.message}`);
      throw new BadRequestException(`Failed to create Netlify deployment: ${error.message}`);
    }
  }

  /**
   * Handle default deployment (GitHub Actions only)
   */
  private handleDefaultDeployment(context: CreateDeploymentContext): Promise<Deployment> {
    return this.createFinalDeployment(context, {
      environmentVariables: context.dto.environment_variables,
      siteId: uuidv4(),
    });
  }

  /**
   * Create the final deployment with processed data
   */
  private createFinalDeployment(
    context: CreateDeploymentContext,
    result: ProviderDeploymentResult,
  ): Promise<Deployment> {
    const { dto, user, entities } = context;

    const deploymentData: ServiceCreateDeploymentDto & { owner: User } = {
      ...dto,
      owner_id: user.id,
      owner: user,
      environment_variables: result.environmentVariables,
      site_id: result.siteId || null,
      deployment_url: result.deploymentUrl,
    };

    return this.deploymentService.createDeployment(deploymentData, entities);
  }

  // ============================================
  // Environment Variable Utilities
  // ============================================

  /**
   * Get required environment variable or throw error
   */
  private getRequiredEnvVar(
    envVars: EnvironmentVariableDto[],
    key: string,
  ): EnvironmentVariableDto {
    const envVar = envVars.find(env => env.key === key);
    if (!envVar) {
      throw new BadRequestException(`${key} is required for this deployment type`);
    }
    return envVar;
  }

  /**
   * Update existing environment variable value
   */
  private updateEnvironmentVariable(
    envVars: EnvironmentVariableDto[],
    key: string,
    value: string,
  ): EnvironmentVariableDto[] {
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
  ): EnvironmentVariableDto[] {
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
}
