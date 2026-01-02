import { Project } from '@app/modules/projects/entities/project.entity';
import { SubscriptionService } from '@app/modules/subscription/services';
import { EncryptionService } from '@app/shared/encryption/encryption.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProjectConfigurationDto } from '../dto/create-project-configuration.dto';
import { UpdateProjectConfigurationDto } from '../dto/update-project-configuration.dto';
import { DeploymentProvider, ProjectConfiguration } from '../entities/project-configuration.entity';

@Injectable()
export class ProjectConfigurationService {
  constructor(
    @InjectRepository(ProjectConfiguration)
    private configRepository: Repository<ProjectConfiguration>,
    private readonly encryptService: EncryptionService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async findOne(id: string): Promise<ProjectConfiguration> {
    const config = await this.configRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`Project configuration with ID ${id} not found`);
    }

    // Decrypt sensitive data (using safeDecrypt to handle both encrypted and plain text)
    config.github_accounts = config.github_accounts.map(githubAccount => ({
      ...githubAccount,
      access_token: this.encryptService.safeDecrypt(githubAccount.access_token),
    }));
    config.deployment_option.environment_variables =
      config.deployment_option.environment_variables.map(variable => ({
        ...variable,
        default_value:
          variable.is_secret && variable.default_value
            ? this.encryptService.safeDecrypt(variable.default_value)
            : variable.default_value,
      }));

    return config;
  }

  async findByProject(projectId: string): Promise<ProjectConfiguration[]> {
    const configs = await this.configRepository.find({
      where: { project_id: projectId },
    });
    return configs.map(config => {
      // Decrypt sensitive data (using safeDecrypt to handle both encrypted and plain text)
      config.github_accounts = config.github_accounts.map(githubAccount => ({
        ...githubAccount,
        access_token: this.encryptService.safeDecrypt(githubAccount.access_token),
      }));
      config.deployment_option.environment_variables =
        config.deployment_option.environment_variables.map(variable => ({
          ...variable,
          default_value:
            variable.is_secret && variable.default_value
              ? this.encryptService.safeDecrypt(variable.default_value)
              : variable.default_value,
        }));
      return config;
    });
  }

  create(
    projectId: string,
    ownerId: string,
    createConfigDto: CreateProjectConfigurationDto,
  ): Promise<ProjectConfiguration> {
    // Use transaction to ensure data consistency
    return this.configRepository.manager.transaction(async transactionalEntityManager => {
      // Check if project exists and user is the owner
      const project = await transactionalEntityManager.findOne(Project, {
        where: { id: projectId },
        relations: ['configurations'],
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }

      if (project.owner_id !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to add configurations to this project',
        );
      }

      const existingConfig = project.configurations.find(
        config =>
          config.deployment_option.provider === createConfigDto.deployment_option.provider &&
          createConfigDto.deployment_option.provider !== DeploymentProvider.CUSTOM,
      );

      if (existingConfig) {
        throw new BadRequestException(
          `A configuration with this provider: ${createConfigDto.deployment_option.provider} already exists for this project`,
        );
      }

      // Validate GitHub accounts limit based on subscription
      const subscription = await this.subscriptionService.getOrCreateSubscription(ownerId);
      const requestedAccounts = createConfigDto.github_accounts?.length || 0;

      if (
        subscription.max_github_accounts !== -1 &&
        requestedAccounts > subscription.max_github_accounts
      ) {
        throw new ForbiddenException(
          `You can only add up to ${subscription.max_github_accounts} GitHub account(s) per configuration based on your subscription plan. Please upgrade to add more accounts.`,
        );
      }

      try {
        // Create the configuration - environment variables will be processed by entity hooks

        const newConfig = this.configRepository.create({
          project_id: projectId,
          ...createConfigDto,
          github_accounts: createConfigDto.github_accounts.map(githubAccount => ({
            ...githubAccount,
            access_token: this.encryptService.encrypt(githubAccount.access_token),
          })),
          deployment_option: {
            ...createConfigDto.deployment_option,
            environment_variables: createConfigDto.deployment_option.environment_variables.map(
              variable => ({
                ...variable,
                default_value:
                  variable.is_secret && variable.default_value
                    ? this.encryptService.encrypt(variable.default_value)
                    : variable.default_value,
              }),
            ),
          },
        });

        // Save within transaction
        return await transactionalEntityManager.save(ProjectConfiguration, newConfig);
      } catch (err) {
        const error = err as Error;

        if (error.message && error.message.includes('encryption')) {
          throw new BadRequestException(`Failed to encrypt sensitive data: ${error.message}`);
        }
        throw error;
      }
    });
  }

  update(
    id: string,
    ownerId: string,
    updateConfigDto: UpdateProjectConfigurationDto,
  ): Promise<ProjectConfiguration> {
    return this.configRepository.manager.transaction(async transactionalEntityManager => {
      const config = await this.findOne(id);

      // Check if user is the owner of the project
      const project = await transactionalEntityManager.findOne(Project, {
        where: { id: config.project_id },
        relations: ['configurations'],
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${config.project_id} not found`);
      }

      if (project.owner_id !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to update this project configuration',
        );
      }

      // Check for provider uniqueness if provider is being updated
      if (updateConfigDto.deployment_option?.provider) {
        const existingConfig = project.configurations.find(
          c =>
            c.id !== id &&
            c.deployment_option.provider === updateConfigDto?.deployment_option?.provider &&
            updateConfigDto?.deployment_option?.provider !== DeploymentProvider.CUSTOM,
        );

        if (existingConfig) {
          throw new BadRequestException(
            `A configuration with this provider: ${updateConfigDto.deployment_option.provider} already exists for this project`,
          );
        }
      }

      // Validate GitHub accounts limit based on subscription (only if updating accounts)
      if (updateConfigDto.github_accounts) {
        const subscription = await this.subscriptionService.getOrCreateSubscription(ownerId);
        const requestedAccounts = updateConfigDto.github_accounts.length;

        if (
          subscription.max_github_accounts !== -1 &&
          requestedAccounts > subscription.max_github_accounts
        ) {
          throw new ForbiddenException(
            `You can only add up to ${subscription.max_github_accounts} GitHub account(s) per configuration based on your subscription plan. Please upgrade to add more accounts.`,
          );
        }
      }

      try {
        // Update configuration - environment variables will be processed by entity hooks
        const upDated = {
          ...updateConfigDto,
          github_accounts: (updateConfigDto?.github_accounts || config.github_accounts).map(
            githubAccount => ({
              ...githubAccount,
              access_token: this.encryptService.encrypt(githubAccount.access_token),
            }),
          ),
          deployment_option: {
            ...updateConfigDto.deployment_option,
            environment_variables: (
              updateConfigDto?.deployment_option?.environment_variables ||
              config.deployment_option.environment_variables
            ).map(variable => ({
              ...variable,
              default_value:
                variable.is_secret && variable.default_value
                  ? this.encryptService.encrypt(variable.default_value)
                  : variable.default_value,
            })),
          },
        };
        Object.assign(config, upDated);

        // Save within transaction
        return transactionalEntityManager.save(ProjectConfiguration, config);
      } catch (err) {
        const error = err as Error;

        if (error.message && error.message.includes('encryption')) {
          throw new BadRequestException(`Failed to encrypt sensitive data: ${error.message}`);
        }
        throw error;
      }
    });
  }

  remove(id: string, ownerId: string): Promise<void> {
    return this.configRepository.manager.transaction(async transactionalEntityManager => {
      const config = await this.findOne(id);

      // Check if user is the owner of the project
      const project = await transactionalEntityManager.findOne(Project, {
        where: { id: config.project_id },
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${config.project_id} not found`);
      }

      if (project.owner_id !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to delete this project configuration',
        );
      }

      await transactionalEntityManager.remove(ProjectConfiguration, config);
    });
  }
}
