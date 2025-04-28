import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { User } from '@app/modules/users/entities/user.entity';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository, ILike, FindOptionsOrder } from 'typeorm';

import { CreateLicenseOptionDto } from '../dto/create-license-option.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseOptionDto } from '../dto/update-license-option.dto';
import { LicenseOption } from '../entities/license-option.entity';

@Injectable()
export class LicenseOptionService {
  constructor(
    @InjectRepository(LicenseOption)
    private licenseRepository: Repository<LicenseOption>,
    private readonly projectRepository: ProjectRepository,
  ) {}

  /**
   * Create a new license option for a project
   */
  async create(user: User, createLicenseDto: CreateLicenseOptionDto): Promise<LicenseOption> {
    // Check if all projects exist and user is the owner of each
    const projects = await Promise.all(
      createLicenseDto.projectIds.map(async projectId => {
        const project = await this.projectRepository.findOne(projectId);

        if (!project) {
          throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        if (project.ownerId !== user.id) {
          throw new BadRequestException(
            `You do not have permission to add license to project: ${project.name}`,
          );
        }

        return project;
      }),
    );

    // Create license without projects first
    const { projectIds: _, ...licenseData } = createLicenseDto;
    const newLicense = this.licenseRepository.create(licenseData);
    const savedLicense = await this.licenseRepository.save(newLicense);

    savedLicense.projects = projects;
    savedLicense.owner = user; // Assuming you have a relation to the User entity
    await this.licenseRepository.save(savedLicense);

    return savedLicense;
  }

  /**
   * Find a license option by ID
   */
  async findOne(id: string): Promise<LicenseOption> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    return license;
  }

  /**
   * Find all license options with filtering, sorting and pagination
   */
  findAll(
    filter: FilterLicenseDto,
    paginationOptions: IPaginationOptions,
  ): Promise<Pagination<LicenseOption>> {
    const { search, currency, sortBy, sortDirection, ownerId } = filter;

    // Build the where conditions
    const whereConditions: Partial<Record<keyof LicenseOption, any>> = {};

    // Add search condition if provided
    if (search) {
      whereConditions.name = ILike(`%${search}%`);
      // If you want to search in description as well, you'd need a more complex query
      // This will be implemented below using queryBuilder
    }

    // Add currency filter if provided
    if (currency) {
      whereConditions.currency = currency;
    }

    // Add currency filter if provided
    if (ownerId) {
      whereConditions.ownerId = ownerId;
    }

    // Build the order condition
    let orderCondition: FindOptionsOrder<LicenseOption> = {};
    if (sortBy) {
      orderCondition[sortBy] = sortDirection || 'ASC';
    } else {
      // Default sort by createdAt desc
      orderCondition = { createdAt: 'DESC' };
    }

    // If we need to search in multiple columns, we need to use queryBuilder
    if (search) {
      const queryBuilder = this.licenseRepository
        .createQueryBuilder('license')
        .leftJoinAndSelect('license.projects', 'projects')
        .where('license.name ILIKE :search OR license.description ILIKE :search', {
          search: `%${search}%`,
        });

      // Add currency filter if provided
      if (currency) {
        queryBuilder.andWhere('license.currency = :currency', { currency });
      }

      // Add sorting
      if (sortBy) {
        queryBuilder.orderBy(`license.${sortBy}`, sortDirection || 'ASC');
      } else {
        queryBuilder.orderBy('license.createdAt', 'DESC');
      }

      return paginate<LicenseOption>(queryBuilder, paginationOptions);
    }

    // If no search is needed, use the simpler approach
    return paginate<LicenseOption>(this.licenseRepository, paginationOptions, {
      where: whereConditions,
      order: orderCondition,
      relations: ['projects'],
    });
  }

  /**
   * Delete a license option
   */
  async remove(id: string, ownerId: string): Promise<void> {
    // Get license with its associated projects
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!license) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Check if user is the owner of all associated projects
    for (const project of license.projects) {
      if (project.ownerId !== ownerId) {
        throw new BadRequestException('You do not have permission to delete this license option');
      }
    }

    // Check if there are any active purchases for this license
    // This should be implemented if you have a purchases repository
    // to prevent deleting licenses that are in use

    await this.licenseRepository.remove(license);
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

    // Get all projects associated with this license
    const licenseWithProjects = await this.licenseRepository.findOne({
      where: { id },
      relations: ['projects'],
    });

    if (!licenseWithProjects) {
      throw new NotFoundException(`License option with ID ${id} not found`);
    }

    // Check if user is the owner of all associated projects
    for (const project of licenseWithProjects.projects) {
      if (project.ownerId !== ownerId) {
        throw new BadRequestException('You do not have permission to update this license option');
      }
    }

    // Validate pricing updates if provided
    if (updateLicenseDto.price && updateLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (updateLicenseDto.deploymentLimit && updateLicenseDto.deploymentLimit < 1) {
      throw new BadRequestException('Deployment limit must be at least 1');
    }

    // Handle project updates if provided
    if (updateLicenseDto.projectIds) {
      // Fetch all projects to be associated with this license
      const projects = await Promise.all(
        updateLicenseDto.projectIds.map(async projectId => {
          const project = await this.projectRepository.findOne(projectId);

          if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
          }

          return project;
        }),
      );

      if (projects.length !== updateLicenseDto.projectIds.length) {
        throw new NotFoundException('One or more projects not found');
      }

      // Verify ownership of all projects
      for (const project of projects) {
        if (project.ownerId !== ownerId) {
          throw new BadRequestException(
            `You do not have permission to add project "${project.name}" to this license`,
          );
        }
      }

      // Update the projects relation
      licenseWithProjects.projects = projects;
    }

    // Update license option fields
    if (updateLicenseDto.name) {
      license.name = updateLicenseDto.name;
    }
    if (updateLicenseDto.description) {
      license.description = updateLicenseDto.description;
    }
    if (updateLicenseDto.price) {
      license.price = updateLicenseDto.price;
    }
    if (updateLicenseDto.currency) {
      license.currency = updateLicenseDto.currency;
    }
    if (updateLicenseDto.deploymentLimit) {
      license.deploymentLimit = updateLicenseDto.deploymentLimit;
    }
    if (updateLicenseDto.duration) {
      license.duration = updateLicenseDto.duration;
    }
    if (updateLicenseDto.features) {
      license.features = updateLicenseDto.features;
    }

    // Save the changes
    Object.assign(licenseWithProjects, license);
    return this.licenseRepository.save(licenseWithProjects);
  }
}
