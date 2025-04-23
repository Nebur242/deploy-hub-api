import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProjectConfigurationDto } from '../dto/create-project-configuration.dto';
import { UpdateProjectConfigurationDto } from '../dto/update-project-configuration.dto';
import { ProjectConfiguration } from '../entities/project-configuration.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class ProjectConfigurationService {
  constructor(
    @InjectRepository(ProjectConfiguration)
    private configRepository: Repository<ProjectConfiguration>,
    private readonly encryptService: EncryptionService,
  ) {}

  async findOne(id: string): Promise<ProjectConfiguration> {
    const config = await this.configRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`Project configuration with ID ${id} not found`);
    }

    // Decrypt sensitive data
    config.githubAccounts = config.githubAccounts.map(githubAccount => ({
      ...githubAccount,
      accessToken: this.encryptService.decrypt(githubAccount.accessToken),
    }));
    config.deploymentOption.environmentVariables = config.deploymentOption.environmentVariables.map(
      variable => ({
        ...variable,
        defaultValue:
          variable.isSecret && variable.defaultValue
            ? this.encryptService.decrypt(variable.defaultValue)
            : variable.defaultValue,
      }),
    );

    return config;
  }

  findByProject(projectId: string): Promise<ProjectConfiguration[]> {
    return this.configRepository.find({
      where: { projectId },
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

      if (project.ownerId !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to add configurations to this project',
        );
      }

      const existingConfig = project.configurations.find(
        config => config.deploymentOption.provider === createConfigDto.deploymentOption.provider,
      );

      if (existingConfig) {
        throw new BadRequestException(
          `A configuration with this provider: ${createConfigDto.deploymentOption.provider} already exists for this project`,
        );
      }

      try {
        // Create the configuration - environment variables will be processed by entity hooks

        const newConfig = this.configRepository.create({
          projectId,
          ...createConfigDto,
          githubAccounts: createConfigDto.githubAccounts.map(githubAccount => ({
            ...githubAccount,
            accessToken: this.encryptService.encrypt(githubAccount.accessToken),
          })),
          deploymentOption: {
            ...createConfigDto.deploymentOption,
            environmentVariables: createConfigDto.deploymentOption.environmentVariables.map(
              variable => ({
                ...variable,
                defaultValue:
                  variable.isSecret && variable.defaultValue
                    ? this.encryptService.encrypt(variable.defaultValue)
                    : variable.defaultValue,
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
        where: { id: config.projectId },
        relations: ['configurations'],
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${config.projectId} not found`);
      }

      if (project.ownerId !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to update this project configuration',
        );
      }

      // Check for provider uniqueness if provider is being updated
      if (updateConfigDto.deploymentOption?.provider) {
        const existingConfig = project.configurations.find(
          c =>
            c.id !== id &&
            c.deploymentOption.provider === updateConfigDto?.deploymentOption?.provider,
        );

        if (existingConfig) {
          throw new BadRequestException(
            `A configuration with this provider: ${updateConfigDto.deploymentOption.provider} already exists for this project`,
          );
        }
      }

      try {
        // Update configuration - environment variables will be processed by entity hooks
        const upDated = {
          ...updateConfigDto,
          githubAccounts: (updateConfigDto?.githubAccounts || config.githubAccounts).map(
            githubAccount => ({
              ...githubAccount,
              accessToken: this.encryptService.encrypt(githubAccount.accessToken),
            }),
          ),
          deploymentOption: {
            ...updateConfigDto.deploymentOption,
            environmentVariables: (
              updateConfigDto?.deploymentOption?.environmentVariables ||
              config.deploymentOption.environmentVariables
            ).map(variable => ({
              ...variable,
              defaultValue:
                variable.isSecret && variable.defaultValue
                  ? this.encryptService.encrypt(variable.defaultValue)
                  : variable.defaultValue,
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
        where: { id: config.projectId },
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${config.projectId} not found`);
      }

      if (project.ownerId !== ownerId) {
        throw new BadRequestException(
          'You do not have permission to delete this project configuration',
        );
      }

      await transactionalEntityManager.remove(ProjectConfiguration, config);
    });
  }
}
