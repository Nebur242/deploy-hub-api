import { ModerationStatus } from '@app/shared/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate, IPaginationOptions } from 'nestjs-typeorm-paginate';
import { FindManyOptions, FindOptionsWhere, Raw, Repository } from 'typeorm';

import { Project, TechStack, Visibility } from '../entities/project.entity';

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  findAll(
    options?: {
      ownerId?: string;
      visibility?: Visibility;
      moderationStatus?: ModerationStatus;
      techStack?: TechStack[];
      categoryIds?: string[];
      search?: string;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    },
    paginationOptions: IPaginationOptions = { page: 1, limit: 10 },
  ) {
    // Create base find options
    const findOptions: FindManyOptions<Project> = {
      relations: ['categories', 'versions', 'configurations'],
      order: { [options?.sortBy || 'updated_at']: options?.sortDirection || 'DESC' },
    };

    // Add where conditions
    const whereConditions: FindOptionsWhere<Project> = {};

    // Apply owner filter
    if (options?.ownerId) {
      whereConditions.owner_id = options.ownerId;
    }

    // Apply visibility filter
    if (options?.visibility) {
      whereConditions.visibility = options.visibility;
    }

    // Apply moderation status filter
    if (options?.moderationStatus) {
      whereConditions.moderation_status = options.moderationStatus;
    }

    // Handle tech stack filtering for repository API
    if (options?.techStack && options.techStack.length > 0) {
      whereConditions.tech_stack = Raw(
        alias => `${alias} && ARRAY[${options.techStack?.map(tech => `'${tech}'`).join(',')}]`,
      );
    }

    // Build search conditions if needed
    if (options?.search) {
      // For combined OR conditions using native repository
      findOptions.where = [
        {
          ...whereConditions,
          name: Raw(alias => `${alias} ILIKE :search`, { search: `%${options.search}%` }),
        },
        {
          ...whereConditions,
          description: Raw(alias => `${alias} ILIKE :search`, { search: `%${options.search}%` }),
        },
      ];
    } else {
      findOptions.where = whereConditions;
    }

    // If category filtering is needed, we need to use a query builder
    // because filtering by relations is hard with the repository API
    if (options?.categoryIds && options.categoryIds.length > 0) {
      const queryBuilder = this.projectRepository
        .createQueryBuilder('project')
        .leftJoinAndSelect('project.categories', 'category')
        .leftJoinAndSelect('project.versions', 'version')
        .orderBy(`project.${options?.sortBy || 'updated_at'}`, options?.sortDirection || 'DESC')
        .where('category.id IN (:...categoryIds)', {
          categoryIds: options.categoryIds,
        });

      // Apply other filters to the query builder
      if (options?.ownerId) {
        queryBuilder.andWhere('project.owner_id = :ownerId', { ownerId: options.ownerId });
      }

      if (options?.visibility) {
        queryBuilder.andWhere('project.visibility = :visibility', {
          visibility: options.visibility,
        });
      }

      if (options?.moderationStatus) {
        queryBuilder.andWhere('project.moderation_status = :moderationStatus', {
          moderationStatus: options.moderationStatus,
        });
      }

      if (options?.techStack && options.techStack.length > 0) {
        queryBuilder.andWhere('project.tech_stack && ARRAY[:...techStack]', {
          techStack: options.techStack,
        });
      }

      if (options?.search) {
        queryBuilder.andWhere('(project.name ILIKE :search OR project.description ILIKE :search)', {
          search: `%${options.search}%`,
        });
      }

      // Use the paginate function from nestjs-typeorm-paginate with query builder
      return paginate<Project>(queryBuilder, paginationOptions);
    }

    // For cases without category filtering, we can use paginate with repository
    return paginate<Project>(this.projectRepository, paginationOptions, findOptions);
  }

  findOne(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id },
      relations: ['versions', 'configurations', 'licenses', 'categories'],
    });
  }

  create(project: Partial<Project>): Promise<Project> {
    const newProject = this.projectRepository.create(project);
    return this.projectRepository.save(newProject);
  }

  update(id: string, project: Partial<Project>) {
    // Use a transaction to ensure data integrity
    return this.projectRepository.manager.transaction(async transactionalEntityManager => {
      // Get the current version with pessimistic lock
      const currentProject = await transactionalEntityManager.findOne(Project, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentProject) {
        throw new Error(`Project with id ${id} not found`);
      }

      // Create the updated project
      const updatedProject = transactionalEntityManager.create(Project, {
        ...currentProject,
        ...project,
        id,
      });

      // Save with transaction
      await transactionalEntityManager.save(updatedProject);

      // Return the updated entity with relations
      return this.findOne(id);
    });
  }

  async remove(id: string): Promise<void> {
    await this.projectRepository.delete(id);
  }

  // Additional helper methods with pagination
  findByOwner(ownerId: string, paginationOptions: IPaginationOptions) {
    return this.findAll({ ownerId }, paginationOptions);
  }

  findPublic(
    options?: {
      techStack?: TechStack[];
      categoryIds?: string[];
      search?: string;
    },
    paginationOptions: IPaginationOptions = { page: 1, limit: 10 },
  ) {
    // Use query builder to ensure we only return projects with at least one license
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.categories', 'category')
      .leftJoinAndSelect('project.versions', 'version')
      .leftJoinAndSelect('project.licenses', 'license')
      .where('project.visibility = :visibility', { visibility: Visibility.PUBLIC })
      .andWhere('project.moderation_status = :moderationStatus', {
        moderationStatus: ModerationStatus.APPROVED,
      })
      // Only show projects with at least one license
      .andWhere(qb => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('project_licenses_license', 'pl')
          .where('pl.project_id = project.id')
          .getQuery();
        return `EXISTS ${subQuery}`;
      })
      .orderBy('project.updated_at', 'DESC');

    // Apply search filter
    if (options?.search) {
      queryBuilder.andWhere('(project.name ILIKE :search OR project.description ILIKE :search)', {
        search: `%${options.search}%`,
      });
    }

    // Apply tech stack filter
    if (options?.techStack && options.techStack.length > 0) {
      queryBuilder.andWhere('project.tech_stack && ARRAY[:...techStack]', {
        techStack: options.techStack,
      });
    }

    // Apply category filter
    if (options?.categoryIds && options.categoryIds.length > 0) {
      queryBuilder.andWhere('category.id IN (:...categoryIds)', {
        categoryIds: options.categoryIds,
      });
    }

    return paginate<Project>(queryBuilder, paginationOptions);
  }

  findFeatured(
    paginationOptions: IPaginationOptions,
    sortOptions?: { sortBy?: string; sortDirection?: 'ASC' | 'DESC' },
  ) {
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.categories', 'category')
      .leftJoinAndSelect('project.versions', 'version')
      .leftJoinAndSelect('project.licenses', 'license')
      .where('project.visibility = :visibility', { visibility: Visibility.FEATURED })
      .andWhere('project.moderation_status = :moderationStatus', {
        moderationStatus: ModerationStatus.APPROVED,
      })
      // Only show projects with at least one license
      .andWhere(qb => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('project_licenses_license', 'pl')
          .where('pl.project_id = project.id')
          .getQuery();
        return `EXISTS ${subQuery}`;
      })
      .orderBy(
        `project.${sortOptions?.sortBy || 'updated_at'}`,
        sortOptions?.sortDirection || 'DESC',
      );

    return paginate<Project>(queryBuilder, paginationOptions);
  }

  /**
   * Find projects pending moderation (for admin)
   */
  findPendingModeration(paginationOptions: IPaginationOptions = { page: 1, limit: 10 }) {
    return this.findAll(
      {
        moderationStatus: ModerationStatus.PENDING,
        sortBy: 'submitted_for_review_at',
        sortDirection: 'ASC', // Oldest first
      },
      paginationOptions,
    );
  }

  /**
   * Find approved projects with pending changes (for admin)
   */
  findPendingChanges(paginationOptions: IPaginationOptions = { page: 1, limit: 10 }) {
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.categories', 'category')
      .leftJoinAndSelect('project.versions', 'version')
      .where('project.has_pending_changes = :hasPendingChanges', { hasPendingChanges: true })
      .andWhere('project.moderation_status = :moderationStatus', {
        moderationStatus: ModerationStatus.CHANGES_PENDING,
      })
      .orderBy('project.pending_changes_submitted_at', 'ASC'); // Oldest first

    return paginate<Project>(queryBuilder, paginationOptions);
  }

  /**
   * Count projects by moderation status (for admin dashboard)
   */
  async countByModerationStatus(): Promise<{ status: ModerationStatus; count: number }[]> {
    const result = await this.projectRepository
      .createQueryBuilder('project')
      .select('project.moderation_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('project.moderation_status')
      .getRawMany<{ status: ModerationStatus; count: string }>();

    return result.map(item => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }

  async countByTechStack(): Promise<{ techStack: TechStack; count: number }[]> {
    const result = await this.projectRepository
      .createQueryBuilder('project')
      .select('unnest(project.tech_stack)', 'techStack')
      .addSelect('COUNT(*)', 'count')
      .groupBy('unnest(project.tech_stack)')
      .getRawMany<{ techStack: string; count: string }>();

    return result.map(item => ({
      techStack: item.techStack as TechStack,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * Count total projects for a specific owner
   */
  countByOwner(ownerId: string): Promise<number> {
    return this.projectRepository.count({
      where: { owner_id: ownerId },
    });
  }

  /**
   * Admin - Find all projects with filtering (no owner restriction)
   */
  findAllAdmin(
    options?: {
      visibility?: Visibility;
      techStack?: TechStack[];
      categoryIds?: string[];
      search?: string;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    },
    paginationOptions: IPaginationOptions = { page: 1, limit: 10 },
  ) {
    return this.findAll(options, paginationOptions);
  }
}
