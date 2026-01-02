import { Order } from '@app/modules/order/entities/order.entity';
import { Project } from '@app/modules/projects/entities/project.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationMeta, IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { UserLicense } from '../entities/user-license.entity';

export interface LicensedProjectsQueryDto {
  page?: number;
  limit?: number;
  visibility?: string;
  search?: string;
  licenseId?: string;
}

@Injectable()
export class UserLicenseService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserLicense)
    private readonly userLicenseRepository: Repository<UserLicense>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Get UserLicense by ID
   */
  async getUserLicenseById(id: string): Promise<UserLicense> {
    const userLicense = await this.userLicenseRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!userLicense) {
      throw new NotFoundException(`User license with ID ${id} not found`);
    }

    return userLicense;
  }

  /**
   * Get all UserLicenses for a specific user
   */
  getUserLicenses(ownerId: string, options: IPaginationOptions): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.owner', 'owner')
      .leftJoinAndSelect('userLicense.license', 'license')
      .where('userLicense.owner_id = :ownerId', { ownerId })
      .orderBy('userLicense.created_at', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }

  /**
   * Get all active UserLicenses for a specific user
   */
  getActiveUserLicenses(ownerId: string): Promise<UserLicense[]> {
    return this.userLicenseRepository.find({
      where: {
        owner_id: ownerId,
        active: true,
      },
      relations: ['owner', 'license'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  /**
   * Get all UserLicenses (admin only)
   */
  getAllUserLicenses(
    options: IPaginationOptions,
    filters?: { owner_id?: string; active?: boolean; license_id?: string },
  ): Promise<Pagination<UserLicense>> {
    const queryBuilder = this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.owner', 'owner');

    // Apply filters if provided
    if (filters?.owner_id) {
      queryBuilder.andWhere('userLicense.owner_id = :ownerId', { ownerId: filters.owner_id });
    }

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('userLicense.active = :active', { active: filters.active });
    }

    if (filters?.license_id) {
      queryBuilder.andWhere('userLicense.license_id = :licenseId', {
        licenseId: filters.license_id,
      });
    }

    queryBuilder.orderBy('userLicense.created_at', 'DESC');

    return paginate<UserLicense>(queryBuilder, options);
  }

  /**
   * Find active user license for a specific license and owner
   */
  findActiveUserLicense(licenseId: string, ownerId: string): Promise<UserLicense | null> {
    return this.userLicenseRepository.findOne({
      where: {
        license_id: licenseId,
        owner_id: ownerId,
        active: true,
      },
    });
  }

  /**
   * Increment deployment count for a user license
   * @param userLicenseId - The ID of the user license
   * @param deploymentId - The ID of the deployment to add to the history
   * @returns The updated user license
   */
  async incrementDeploymentCount(
    userLicenseId: string,
    deploymentId: string,
  ): Promise<UserLicense> {
    const userLicense = await this.getUserLicenseById(userLicenseId);

    userLicense.count = userLicense.count + 1;
    userLicense.deployments = [...(userLicense.deployments || []), deploymentId];

    return this.userLicenseRepository.save(userLicense);
  }

  /**
   * Check if user license has available deployments
   * @param userLicenseId - The ID of the user license
   * @returns True if deployments are available
   */
  async hasAvailableDeployments(userLicenseId: string): Promise<boolean> {
    const userLicense = await this.getUserLicenseById(userLicenseId);
    return userLicense.active && userLicense.count < userLicense.max_deployments;
  }

  /**
   * Get remaining deployment count for a user license
   * @param userLicenseId - The ID of the user license
   * @returns Number of remaining deployments
   */
  async getRemainingDeployments(userLicenseId: string): Promise<number> {
    const userLicense = await this.getUserLicenseById(userLicenseId);
    return Math.max(0, userLicense.max_deployments - userLicense.count);
  }

  /**
   * Save a user license
   */
  save(userLicense: UserLicense): Promise<UserLicense> {
    return this.userLicenseRepository.save(userLicense);
  }

  /**
   * Get user licenses for specific license IDs with license and project relations
   * Used for statistics calculations
   */
  getUserLicensesByLicenseIds(licenseIds: string[]): Promise<UserLicense[]> {
    if (licenseIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .leftJoinAndSelect('userLicense.license', 'license')
      .leftJoinAndSelect('license.projects', 'project')
      .where('userLicense.license_id IN (:...licenseIds)', { licenseIds })
      .getMany();
  }

  /**
   * Get all user licenses for a specific owner (for user statistics)
   */
  findAllByOwner(ownerId: string): Promise<UserLicense[]> {
    return this.userLicenseRepository.find({
      where: { owner_id: ownerId },
    });
  }

  /**
   * Check if a user has an active license for a specific project
   * @param projectId The project's ID
   * @param userId The user's ID
   * @returns True if the user has an active license for the project
   */
  async hasLicenseForProject(projectId: string, userId: string): Promise<boolean> {
    const userLicense = await this.userLicenseRepository
      .createQueryBuilder('userLicense')
      .innerJoin('userLicense.license', 'license')
      .innerJoin('license.projects', 'project')
      .where('userLicense.owner_id = :userId', { userId })
      .andWhere('project.id = :projectId', { projectId })
      .andWhere('userLicense.active = :active', { active: true })
      .getOne();

    return !!userLicense;
  }

  /**
   * Get projects that the user has access to via active user licenses
   * @param userId The user's ID
   * @param query Query parameters for filtering and pagination
   * @returns Paginated list of projects the user has access to through licenses
   */
  async getLicensedProjects(
    userId: string,
    query: LicensedProjectsQueryDto,
  ): Promise<Pagination<Project, IPaginationMeta>> {
    const { page = 1, limit = 10, visibility, search, licenseId } = query;

    // Get license IDs from user's active user licenses
    const userLicenseQuery = this.userLicenseRepository
      .createQueryBuilder('ul')
      .select('DISTINCT ul.license_id', 'license_id')
      .where('ul.owner_id = :userId', { userId })
      .andWhere('ul.active = :active', { active: true })
      .andWhere('ul.status = :status', { status: 'active' })
      .andWhere('(ul.expires_at IS NULL OR ul.expires_at > :now)', { now: new Date() });

    if (licenseId) {
      userLicenseQuery.andWhere('ul.license_id = :licenseId', { licenseId });
    }

    const licenseIdsResult = await userLicenseQuery.getRawMany<{ license_id: string }>();
    const licenseIds = licenseIdsResult.map(item => item.license_id);

    // If no licenses found, return empty response
    if (!licenseIds.length) {
      return {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: limit,
          totalPages: 0,
          currentPage: page,
        },
      };
    }

    // Get projects associated with these licenses through the join table
    const projectQuery = this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.licenses', 'license')
      .leftJoinAndSelect('project.licenses', 'projectLicenses')
      .leftJoinAndSelect('project.configurations', 'configurations')
      .where('license.id IN (:...licenseIds)', { licenseIds });

    // Apply optional filters
    if (visibility) {
      projectQuery.andWhere('project.visibility = :visibility', { visibility });
    }

    if (search) {
      const searchTerm = `%${search}%`;
      projectQuery.andWhere('(project.name ILIKE :search OR project.description ILIKE :search)', {
        search: searchTerm,
      });
    }

    projectQuery.orderBy('project.created_at', 'DESC');

    // Execute the paginated query
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
    };

    return paginate<Project>(projectQuery, paginationOptions);
  }
}
