import { EncryptionService } from '@app/common/encryption/encryption.service';
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
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async findOne(id: string): Promise<ProjectConfiguration> {
    const config = await this.configRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`Project configuration with ID ${id} not found`);
    }

    return config;
  }

  findByProject(projectId: string): Promise<ProjectConfiguration[]> {
    return this.configRepository.find({
      where: { projectId },
    });
  }

  async create(
    projectId: string,
    ownerId: string,
    createConfigDto: CreateProjectConfigurationDto,
  ): Promise<ProjectConfiguration> {
    // Check if project exists and user is the owner
    const project = await this.projectRepository.findOne({
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

    const newConfig = this.configRepository.create({
      projectId,
      ...createConfigDto,
    });

    newConfig.encryptSensitiveData(this.encryptionService);

    return this.configRepository.save(newConfig);
  }

  async update(
    id: string,
    ownerId: string,
    updateConfigDto: UpdateProjectConfigurationDto,
  ): Promise<ProjectConfiguration> {
    const config = await this.findOne(id);
    // Check if user is the owner of the project
    const project = await this.projectRepository.findOne({
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
    // Update configuration
    Object.assign(config, updateConfigDto);
    config.encryptSensitiveData(this.encryptionService);

    return this.configRepository.save(config);
  }
  async remove(id: string, ownerId: string): Promise<void> {
    const config = await this.findOne(id);

    // Check if user is the owner of the project
    const project = await this.projectRepository.findOne({
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

    await this.configRepository.remove(config);
  }
}
