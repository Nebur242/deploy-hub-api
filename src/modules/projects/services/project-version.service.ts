import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateVersionDto } from '../dto/create-version.dto';
import { UpdateVersionDto } from '../dto/update-version.dto';
import { ProjectVersion } from '../entities/project-version.entity';
import { Project } from '../entities/project.entity';

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
      where: { projectId },
      order: { createdAt: 'DESC' },
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
      relations: ['versions'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to add versions to this project');
    }

    // Check if version already exists
    const existingVersion = await this.projectVersionRepository.findOne({
      where: { projectId, version: versionData.version },
    });

    if (existingVersion) {
      throw new BadRequestException(
        `Version ${versionData.version} already exists for this project`,
      );
    }

    // Set all other versions as not latest
    if (project.versions && project.versions.length > 0) {
      await this.projectVersionRepository.update(
        { projectId, isLatest: true },
        { isLatest: false },
      );
    }

    // Create new version
    const newVersion = this.projectVersionRepository.create({
      projectId,
      ...versionData,
      isLatest: true,
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
      where: { id: version.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
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
      where: { id: version.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to modify this project version');
    }

    // Set all versions as not stable
    await this.projectVersionRepository.update(
      { projectId: version.projectId },
      { isStable: false },
    );

    // Set this version as stable
    version.isStable = true;
    return this.projectVersionRepository.save(version);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const version = await this.findOne(id);
    const project = await this.projectRepository.findOne({
      where: { id: version.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${version.projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
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
        where: { projectId: version.projectId },
        order: { createdAt: 'DESC' },
      });

      // Set the newest version as latest if any versions remain
      if (versions.length > 0) {
        await transactionalEntityManager.update(
          ProjectVersion,
          { projectId: version.projectId, id: versions[0].id },
          { isLatest: true },
        );
      }
    });
  }
}
