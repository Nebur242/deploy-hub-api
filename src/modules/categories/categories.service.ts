import { User } from '@app/modules/users/entities/user.entity';
import { Role } from '@app/shared/enums';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate, Pagination, IPaginationOptions } from 'nestjs-typeorm-paginate';
import { FindManyOptions, ILike, IsNull, Repository } from 'typeorm';

import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto, user: User): Promise<Category> {
    // Check if category with the same name or slug already exists
    const existingCategory = await this.categoryRepository.findOne({
      where: [{ name: createCategoryDto.name }, { slug: createCategoryDto.slug }],
    });

    if (existingCategory?.name === createCategoryDto.name) {
      throw new ConflictException(
        `Category with this name: ${createCategoryDto.name} already exists`,
      );
    }

    if (existingCategory?.slug === createCategoryDto.slug) {
      throw new ConflictException(
        `Category with this slug: ${createCategoryDto.slug} already exists`,
      );
    }
    // Validate parent category if provided
    if (createCategoryDto.parent_id && createCategoryDto.parent_id !== 'root') {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parent_id },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
    }

    // Create and save the new category
    const category = this.categoryRepository.create({
      ...createCategoryDto,
      owner_id: user.id,
      parent_id: createCategoryDto.parent_id === 'root' ? null : createCategoryDto.parent_id,
    });

    return this.categoryRepository.save(category);
  }

  /**
   * Find all categories with optional filtering
   */
  findAll(filters: CategoryFilterDto): Promise<Pagination<Category>> {
    const { parent_id, search, status, owner_id, page = 1, limit = 10 } = filters;

    // Build where conditions
    const where: FindManyOptions<Category>['where'] = {
      owner_id,
    };

    if (parent_id === 'root') {
      where.parent_id = IsNull();
    } else if (parent_id) {
      where.parent_id = parent_id;
    }

    if (status) {
      where.status = status;
    }

    // For the search functionality, we'll need to use a custom option
    const options: FindManyOptions<Category> = {
      where,
      relations: ['parent'],
      order: {
        sort_order: 'ASC',
        name: 'ASC',
      },
    };

    if (search) {
      options.where = [{ ...where, name: ILike(`%${search}%`) }];
    }

    return paginate<Category>(this.categoryRepository, { page, limit }, options);
  }

  /**
   * Find all categories with pagination and optional filtering
   */
  findAllPaginated(
    options: IPaginationOptions,
    filters: CategoryFilterDto,
  ): Promise<Pagination<Category>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { parent_id, status, owner_id, search } = filters;
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');

    // Apply filters
    if (filters.parent_id === 'root') {
      queryBuilder.andWhere('category.parent_id IS NULL');
    } else if (filters.parent_id) {
      queryBuilder.andWhere('category.parent_id = :parentId', { parentId: filters.parent_id });
    }

    if (filters.status) {
      queryBuilder.andWhere('category.status = :status', { status: filters.status });
    }

    if (filters.owner_id) {
      queryBuilder.andWhere('category.owner_id = :ownerId', { ownerId: filters.owner_id });
    }

    if (filters.search) {
      queryBuilder.andWhere('category.name ILIKE :search', { search: `%${filters.search}%` });
    }

    queryBuilder.orderBy('category.sort_order', 'ASC').addOrderBy('category.name', 'ASC');

    return paginate<Category>(queryBuilder, options);
  }

  /**
   * Build a hierarchical tree of categories
   */
  async getCategoryTree(filters: CategoryFilterDto): Promise<Category[]> {
    const allCategories = await this.findAll(filters);
    // Using underscore prefix to indicate intentionally unused variable
    const _rootCategories = allCategories.items.filter(
      category =>
        (!category.parent_id || filters.parent_id === category.id) &&
        category.owner_id === filters.owner_id,
    );

    // Define a type for category with children
    type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

    const buildTree = (
      categories: Category[],
      parentId: string | null = null,
    ): CategoryWithChildren[] => {
      return categories
        .filter(category => category.parent_id === parentId)
        .map(category => {
          const children = buildTree(categories, category.id);
          const categoryWithChildren: CategoryWithChildren = {
            ...category,
            children: children.length > 0 ? children : [],
          };
          return categoryWithChildren;
        });
    };

    return buildTree(allCategories.items);
  }

  /**
   * Find category by ID
   */
  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug, status: 'active' },
      relations: ['parent'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Update category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto, user: User): Promise<Category> {
    const category = await this.findOne(id);

    // Check ownership or admin permission
    this.checkPermission(category, user);

    // Check for name/slug conflicts
    if (updateCategoryDto.name || updateCategoryDto.slug) {
      const whereConditions: { [key: string]: any }[] = [];
      if (updateCategoryDto.name) {
        whereConditions.push({ name: updateCategoryDto.name });
      }
      if (updateCategoryDto.slug) {
        whereConditions.push({ slug: updateCategoryDto.slug });
      }

      const existingCategory = await this.categoryRepository.findOne({
        where: whereConditions.length > 0 ? whereConditions : undefined,
      });

      if (existingCategory && existingCategory.id !== id) {
        if (existingCategory?.name === updateCategoryDto.name) {
          throw new ConflictException(
            `Category with this name: ${updateCategoryDto.name} already exists`,
          );
        }

        if (existingCategory?.slug === updateCategoryDto.slug) {
          throw new ConflictException(
            `Category with this slug: ${updateCategoryDto.slug} already exists`,
          );
        }
      }
    }

    // Validate parent category if changing
    if (
      updateCategoryDto.parent_id &&
      updateCategoryDto.parent_id !== category.parent_id &&
      updateCategoryDto.parent_id !== 'root'
    ) {
      // Prevent circular references
      if (updateCategoryDto.parent_id === id) {
        throw new ConflictException('Category cannot be its own parent');
      }

      const parentCategory = await this.categoryRepository.findOne({
        where: { id: updateCategoryDto.parent_id },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }

      // Check for deeper circular references
      let currentParent = parentCategory;
      while (currentParent.parent_id) {
        if (currentParent.parent_id === id) {
          throw new ConflictException('Circular reference detected in category hierarchy');
        }
        const parent = await this.categoryRepository.findOne({
          where: { id: currentParent.parent_id },
        });

        if (!parent) {
          throw new NotFoundException(
            `Parent category with ID ${currentParent.parent_id} not found`,
          );
        }

        currentParent = parent;
      }
      Object.assign(category, updateCategoryDto);
      return this.categoryRepository.save({
        ...category,
        parent: parentCategory,
      });
    }

    if (updateCategoryDto.parent_id === 'root') {
      Object.assign(category, updateCategoryDto);
      return this.categoryRepository.save({
        ...category,
        parent_id: null,
        parent: undefined,
      });
    }
    // Update and save
    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Remove category
   */
  async remove(id: string, user: User): Promise<void> {
    const category = await this.findOne(id);

    // Check ownership or admin permission
    this.checkPermission(category, user);

    // Check if category has children
    const childrenCount = await this.categoryRepository.count({
      where: { parent_id: id },
    });

    if (childrenCount > 0) {
      throw new ConflictException('Cannot delete category with child categories');
    }

    await this.categoryRepository.remove(category);
  }

  /**
   * Check if user has permission to modify category
   */
  private checkPermission(category: Category, user: User): void {
    const isAdmin = user.roles.includes(Role.ADMIN);
    const isOwner = category.owner_id === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You do not have permission to modify this category');
    }
  }
}
