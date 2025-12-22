import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { User } from '@app/modules/users/entities/user.entity';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository, ILike, FindOptionsOrder } from 'typeorm';

import { CreateLicenseDto } from '../dto/create-license.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';
import { License } from '../entities/license.entity';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    private readonly projectRepository: ProjectRepository,
  ) {}

  /**
   * Create a new license option for a project
   */
  async create(user: User, createLicenseDto: CreateLicenseDto): Promise<License> {
    // Check if all projects exist and user is the owner of each
    const projects = await Promise.all(
      createLicenseDto.projectIds.map(async projectId => {
        const project = await this.projectRepository.findOne(projectId);

        if (!project) {
          throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        if (project.owner_id !== user.id) {
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
    savedLicense.ownerId = user.id; // Assuming you have a relation to the User entity
    savedLicense.owner = user; // Assuming you have a relation to the User entity
    await this.licenseRepository.save(savedLicense);

    return savedLicense;
  }

  /**
   * Find a license option by ID
   */
  async findOne(id: string): Promise<License> {
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
  ): Promise<Pagination<License>> {
    const { search, currency, sortBy, sortDirection, ownerId, status, projectId } = filter;

    // Build the where conditions
    const whereConditions: Record<string, unknown> = {};

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

    // Add owner filter if provided
    if (ownerId) {
      whereConditions.ownerId = ownerId;
    }

    // Add status filter if provided
    if (status) {
      whereConditions.status = status;
    }

    // Build the order condition
    let orderCondition: FindOptionsOrder<License> = {};
    if (sortBy) {
      orderCondition[sortBy] = sortDirection || 'ASC';
    } else {
      // Default sort by createdAt desc
      orderCondition = { createdAt: 'DESC' };
    }

    // If we need to search in multiple columns or filter by projectId, we need to use queryBuilder
    if (search || projectId) {
      const queryBuilder = this.licenseRepository
        .createQueryBuilder('license')
        .leftJoinAndSelect('license.projects', 'projects');

      // Add search condition if provided
      if (search) {
        queryBuilder.where('license.name ILIKE :search OR license.description ILIKE :search', {
          search: `%${search}%`,
        });
      }

      // Add projectId filter if provided
      if (projectId) {
        if (search) {
          queryBuilder.andWhere('projects.id = :projectId', { projectId });
        } else {
          queryBuilder.where('projects.id = :projectId', { projectId });
        }
      }

      // Add currency filter if provided
      if (currency) {
        queryBuilder.andWhere('license.currency = :currency', { currency });
      }

      // Add owner filter if provided
      if (ownerId) {
        queryBuilder.andWhere('license.ownerId = :ownerId', { ownerId });
      }

      // Add status filter if provided
      if (status) {
        queryBuilder.andWhere('license.status = :status', { status });
      }

      // Add sorting
      if (sortBy) {
        queryBuilder.orderBy(`license.${sortBy}`, sortDirection || 'ASC');
      } else {
        queryBuilder.orderBy('license.createdAt', 'DESC');
      }

      return paginate<License>(queryBuilder, paginationOptions);
    }

    // If no search is needed, use the simpler approach
    return paginate<License>(this.licenseRepository, paginationOptions, {
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
      if (project.owner_id !== ownerId) {
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
  async update(id: string, owner_id: string, updateLicenseDto: UpdateLicenseDto): Promise<License> {
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
      if (project.owner_id !== owner_id) {
        throw new BadRequestException('You do not have permission to update this license option');
      }
    }

    // Validate pricing updates if provided
    if (updateLicenseDto.price !== undefined && updateLicenseDto.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (updateLicenseDto.deploymentLimit !== undefined && updateLicenseDto.deploymentLimit < 1) {
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

          if (project.owner_id !== owner_id) {
            throw new BadRequestException(
              `You do not have permission to add project "${project.name}" to this license`,
            );
          }

          return project;
        }),
      );

      license.projects = projects;
    }

    // Update license option fields by applying all defined properties from DTO
    const { projectIds: _projectIds, ...licenseUpdates } = updateLicenseDto;

    // Directly apply all updates from the DTO to the license object
    Object.assign(license, licenseUpdates);

    // Save the changes
    return this.licenseRepository.save(license);
  }
}
