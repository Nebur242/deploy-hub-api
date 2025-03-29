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

    if (existingCategory) {
      throw new ConflictException(
        existingCategory.name === createCategoryDto.name
          ? 'Category with this name already exists'
          : 'Category with this slug already exists',
      );
    }

    // Validate parent category if provided
    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
    }

    // Create and save the new category
    const category = this.categoryRepository.create({
      ...createCategoryDto,
      ownerId: user.id,
    });

    return this.categoryRepository.save(category);
  }

  /**
   * Find all categories with optional filtering
   */
  findAll(filters: CategoryFilterDto = {}): Promise<Pagination<Category>> {
    const { parentId, search, status, page = 1, limit = 10 } = filters;

    // Build where conditions
    const where: FindManyOptions<Category>['where'] = {};

    if (parentId === 'root') {
      where.parentId = IsNull();
    } else if (parentId) {
      where.parentId = parentId;
    }

    if (status) {
      where.status = status;
    }

    // For the search functionality, we'll need to use a custom option
    const options: FindManyOptions<Category> = {
      where,
      relations: ['media'],
      order: {
        sortOrder: 'ASC',
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
    filters: CategoryFilterDto = {},
  ): Promise<Pagination<Category>> {
    const { parentId, status, search } = filters;
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');

    // Apply filters
    if (parentId === 'root') {
      queryBuilder.andWhere('category.parentId IS NULL');
    } else if (parentId) {
      queryBuilder.andWhere('category.parentId = :parentId', { parentId });
    }

    if (status) {
      queryBuilder.andWhere('category.status = :isActive', { status });
    }

    if (search) {
      queryBuilder.andWhere('category.name ILIKE :search', { search: `%${search}%` });
    }

    queryBuilder.orderBy('category.sortOrder', 'ASC').addOrderBy('category.name', 'ASC');

    return paginate<Category>(queryBuilder, options);
  }

  /**
   * Build a hierarchical tree of categories
   */
  async getCategoryTree(filters: CategoryFilterDto = {}): Promise<Category[]> {
    const allCategories = await this.findAll(filters);
    // Using underscore prefix to indicate intentionally unused variable
    const _rootCategories = allCategories.items.filter(
      category => !category.parentId || filters.parentId === category.id,
    );

    // Define a type for category with children
    type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

    const buildTree = (
      categories: Category[],
      parentId: string | null = null,
    ): CategoryWithChildren[] => {
      return categories
        .filter(category => category.parentId === parentId)
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
        throw new ConflictException(
          existingCategory.name === updateCategoryDto.name
            ? 'Category with this name already exists'
            : 'Category with this slug already exists',
        );
      }
    }

    // Validate parent category if changing
    if (updateCategoryDto.parentId && updateCategoryDto.parentId !== category.parentId) {
      // Prevent circular references
      if (updateCategoryDto.parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }

      const parentCategory = await this.categoryRepository.findOne({
        where: { id: updateCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }

      // Check for deeper circular references
      let currentParent = parentCategory;
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          throw new ConflictException('Circular reference detected in category hierarchy');
        }
        const parent = await this.categoryRepository.findOne({
          where: { id: currentParent.parentId },
        });

        if (!parent) {
          throw new NotFoundException(
            `Parent category with ID ${currentParent.parentId} not found`,
          );
        }

        currentParent = parent;
      }
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
      where: { parentId: id },
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
    const isOwner = category.ownerId === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You do not have permission to modify this category');
    }
  }
}
