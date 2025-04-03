// src/projects/services/license-option.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, Pagination, paginate } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { CreateLicenseOptionDto } from '../dto/create-license-option.dto';
import { UpdateLicenseOptionDto } from '../dto/update-license-option.dto';
import { LicenseOption, Currency } from '../entities/license-option.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class LicenseOptionService {
  constructor(
    @InjectRepository(LicenseOption)
    private licenseRepository: Repository<LicenseOption>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  /**
   * Find a license option by ID
   */
  async findOne(id: string): Promise<LicenseOption> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    return license;
  }

  /**
   * Find all license options for a project with pagination
   */
  findByProject(
    projectId: string,
    paginationOptions?: IPaginationOptions,
  ): Promise<Pagination<LicenseOption>> {
    const queryBuilder = this.licenseRepository
      .createQueryBuilder('license')
      .where('license.projectId = :projectId', { projectId })
      .orderBy('license.price', 'ASC');

    // Provide default pagination options if none are provided
    const options: IPaginationOptions = paginationOptions || {
      page: 1,
      limit: 10,
    };

    return paginate<LicenseOption>(queryBuilder, options);
  }

  /**
   * Create a new license option for a project
   */
  async create(
    projectId: string,
    ownerId: string,
    createLicenseDto: CreateLicenseOptionDto,
  ): Promise<LicenseOption> {
    // Check if project exists and user is the owner
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new BadRequestException(
        'You do not have permission to add license options to this project',
      );
    }

    // Validate pricing info
    if (createLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (createLicenseDto.deploymentLimit < 1) {
      throw new BadRequestException('Deployment limit must be at least 1');
    }

    // Create new license option
    const newLicense = this.licenseRepository.create({
      projectId,
      name: createLicenseDto.name,
      description: createLicenseDto.description,
      price: createLicenseDto.price,
      currency: createLicenseDto.currency || Currency.USD,
      deploymentLimit: createLicenseDto.deploymentLimit || 1,
      duration: createLicenseDto.duration || 0, // 0 means unlimited
      features: createLicenseDto.features || [],
    });

    return this.licenseRepository.save(newLicense);
  }

  /**
   * Update an existing license option
   */
  async update(
    id: string,
    ownerId: string,
    updateLicenseDto: UpdateLicenseOptionDto,
  ): Promise<LicenseOption> {
    const license = await this.findOne(id);

    // Check if user is the owner of the project
    const project = await this.projectRepository.findOne({
      where: { id: license.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${license.projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to update this license option');
    }

    // Validate pricing updates if provided
    if (updateLicenseDto.price !== undefined && updateLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (updateLicenseDto.deploymentLimit !== undefined && updateLicenseDto.deploymentLimit < 1) {
      throw new BadRequestException('Deployment limit must be at least 1');
    }

    // Update license option fields
    if (updateLicenseDto.name !== undefined) {
      license.name = updateLicenseDto.name;
    }
    if (updateLicenseDto.description !== undefined) {
      license.description = updateLicenseDto.description;
    }
    if (updateLicenseDto.price !== undefined) {
      license.price = updateLicenseDto.price;
    }
    if (updateLicenseDto.currency !== undefined) {
      license.currency = updateLicenseDto.currency;
    }
    if (updateLicenseDto.deploymentLimit !== undefined) {
      license.deploymentLimit = updateLicenseDto.deploymentLimit;
    }
    if (updateLicenseDto.duration !== undefined) {
      license.duration = updateLicenseDto.duration;
    }
    if (updateLicenseDto.features !== undefined) {
      license.features = updateLicenseDto.features;
    }

    return this.licenseRepository.save(license);
  }

  /**
   * Delete a license option
   */
  async remove(id: string, ownerId: string): Promise<void> {
    const license = await this.findOne(id);

    // Check if user is the owner of the project
    const project = await this.projectRepository.findOne({
      where: { id: license.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${license.projectId} not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new BadRequestException('You do not have permission to delete this license option');
    }

    // Check if there are any active purchases for this license
    // This should be implemented if you have a purchases repository
    // to prevent deleting licenses that are in use

    await this.licenseRepository.remove(license);
  }

  /**
   * Get all public license options for a project (no authentication required)
   */
  async findPublicByProject(
    projectId: string,
    paginationOptions?: IPaginationOptions,
  ): Promise<Pagination<LicenseOption>> {
    // First check if the project is public
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const queryBuilder = this.licenseRepository
      .createQueryBuilder('license')
      .where('license.projectId = :projectId', { projectId })
      .orderBy('license.price', 'ASC');

    // Provide default pagination options if none are provided
    const options: IPaginationOptions = paginationOptions || {
      page: 1,
      limit: 10,
    };

    return paginate<LicenseOption>(queryBuilder, options);
  }

  /**
   * Get available license tiers (for displaying on pricing page)
   */
  getLicenseTiers(): Promise<any[]> {
    // Example of custom data aggregation
    // This would be project-specific in a real application
    return Promise.resolve([
      {
        tier: 'Basic',
        averagePrice: 29.99,
        typicalFeatures: ['Single deployment', 'Email support', '1 year updates'],
      },
      {
        tier: 'Professional',
        averagePrice: 99.99,
        typicalFeatures: ['Up to 5 deployments', 'Priority support', 'Lifetime updates'],
      },
      {
        tier: 'Enterprise',
        averagePrice: 299.99,
        typicalFeatures: [
          'Unlimited deployments',
          '24/7 support',
          'Customization options',
          'Dedicated account manager',
        ],
      },
    ]);
  }
}
