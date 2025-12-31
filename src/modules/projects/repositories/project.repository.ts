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
    paginationOptions?: IPaginationOptions,
  ) {
    return this.findAll(
      {
        ...options,
        visibility: Visibility.PUBLIC,
      },
      paginationOptions,
    );
  }

  findFeatured(
    paginationOptions: IPaginationOptions,
    sortOptions?: { sortBy?: string; sortDirection?: 'ASC' | 'DESC' },
  ) {
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.categories', 'category')
      .leftJoinAndSelect('project.versions', 'version')
      .where('project.visibility = :visibility', { visibility: Visibility.FEATURED })
      .orderBy(
        `project.${sortOptions?.sortBy || 'updated_at'}`,
        sortOptions?.sortDirection || 'DESC',
      );

    return paginate<Project>(queryBuilder, paginationOptions);
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
