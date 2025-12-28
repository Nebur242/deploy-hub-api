import { Project } from '@app/modules/projects/entities/project.entity';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateVersionDto } from '../dto/create-version.dto';
import { UpdateVersionDto } from '../dto/update-version.dto';
import { ProjectVersion } from '../entities/project-version.entity';

@Injectable()
export class ProjectVersionService {
  constructor(
    @InjectRepository(ProjectVersion)
    private projectVersionRepository: Repository<ProjectVersion>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  findAll(projectId: string): Promise<ProjectVersion[]> {
    return this.projectVersionRepository.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ProjectVersion> {
    const version = await this.projectVersionRepository.findOne({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException(`Project version with ID ${id} not found`);
    }

    return version;
  }

  async create(
    projectId: string,
    ownerId: string,
    versionData: CreateVersionDto,
  ): Promise<ProjectVersion> {
    // Check if project exists and user is the owner
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['versions', 'configurations'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to add versions to this project');
    }

    // Check if project has any configuration - prevent version creation if not
    if (!project.configurations || project.configurations.length === 0) {
      throw new BadRequestException(
        'Cannot create a version for this project because it has no configuration',
      );
    }

    // Check if version already exists
    const existingVersion = await this.projectVersionRepository.findOne({
      where: { project_id: projectId, version: versionData.version },
    });

    if (existingVersion) {
      throw new BadRequestException(
        `Version ${versionData.version} already exists for this project`,
      );
    }

    // Set all other versions as not latest
    if (project.versions && project.versions.length > 0) {
      await this.projectVersionRepository.update(
        { project_id: projectId, is_latest: true },
        { is_latest: false },
      );
    }

    // Create new version
    const newVersion = this.projectVersionRepository.create({
      project_id: projectId,
      ...versionData,
      is_latest: true,
    });

    return this.projectVersionRepository.save(newVersion);
  }

  async updateVersion(
    id: string,
    ownerId: string,
    updateVersionDto: UpdateVersionDto,
  ): Promise<ProjectVersion> {
    const version = await this.findOne(id);

    // Check if user has permission to update this version
    const project = await this.projectRepository.findOne({
      where: { id: version.project_id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.project_id} not found`);
    }

    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to update this project version');
    }

    const updatedVersion = this.projectVersionRepository.create({
      ...version,
      ...updateVersionDto,
    });

    return this.projectVersionRepository.save(updatedVersion);
  }

  async setAsStable(id: string, ownerId: string): Promise<ProjectVersion> {
    const version = await this.findOne(id);
    const project = await this.projectRepository.findOne({
      where: { id: version.project_id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.project_id} not found`);
    }

    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to modify this project version');
    }

    // Set all versions as not stable
    await this.projectVersionRepository.update(
      { project_id: version.project_id },
      { is_stable: false },
    );

    // Set this version as stable
    version.is_stable = true;
    return this.projectVersionRepository.save(version);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const version = await this.findOne(id);
    const project = await this.projectRepository.findOne({
      where: { id: version.project_id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.project_id} not found`);
    }

    if (project.owner_id !== ownerId) {
      throw new BadRequestException('You do not have permission to delete this project version');
    }

    await this.projectVersionRepository.delete(id);

    // set the last version as latest if this was the last version
    // Use a transaction to ensure atomicity when removing version and updating latest flag
    await this.projectVersionRepository.manager.transaction(async transactionalEntityManager => {
      // Delete the version first
      await transactionalEntityManager.delete(ProjectVersion, id);

      // Find the newest remaining version
      const versions = await transactionalEntityManager.find(ProjectVersion, {
        where: { project_id: version.project_id },
        order: { created_at: 'DESC' },
      });

      // Set the newest version as latest if any versions remain
      if (versions.length > 0) {
        await transactionalEntityManager.update(
          ProjectVersion,
          { project_id: version.project_id, id: versions[0].id },
          { is_latest: true },
        );
      }
    });
  }
}
