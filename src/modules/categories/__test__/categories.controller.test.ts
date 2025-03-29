/* eslint-disable @typescript-eslint/unbound-method */
import { User } from '@app/modules/users/entities/user.entity';
import { Test, TestingModule } from '@nestjs/testing';

import { CategoryController } from '../categories.controller';
import { CategoryService } from '../categories.service';
import {
  CategoryFilterDto,
  CategoryResponseDto,
  CategoryTreeDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/category.dto';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: CategoryService;

  const mockUser: User = { id: 'user-id', email: 'test@example.com' } as unknown as User;

  const mockCategory: CategoryResponseDto = {
    id: 'category-id',
    name: 'Test Category',
    slug: 'test-category',
    description: 'Test Description',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    icon: '',
    sortOrder: 0,
  };

  const mockPagination = {
    items: [mockCategory],
    meta: {
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    },
    links: {
      first: 'link',
      previous: '',
      next: '',
      last: 'link',
    },
  };

  const mockCategoryTree: CategoryTreeDto[] = [
    {
      id: 'category-id',
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test Description',
      status: 'active',
      children: [],
      icon: '',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockCategoryService = {
    create: jest.fn().mockResolvedValue(mockCategory),
    findAll: jest.fn().mockResolvedValue(mockPagination),
    findAllPaginated: jest.fn().mockResolvedValue(mockPagination),
    getCategoryTree: jest.fn().mockResolvedValue(mockCategoryTree),
    findOne: jest.fn().mockResolvedValue(mockCategory),
    findBySlug: jest.fn().mockResolvedValue(mockCategory),
    update: jest.fn().mockResolvedValue(mockCategory),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get<CategoryService>(CategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        description: 'Test Description',
        slug: '',
        status: 'pending',
      };

      const result = await controller.create(createCategoryDto, mockUser);

      expect(result).toEqual(mockCategory);
      expect(service.create).toHaveBeenCalledWith(createCategoryDto, mockUser);
    });
  });

  describe('findAll', () => {
    it('should return an array of categories', async () => {
      const filters: CategoryFilterDto = {
        status: 'active',
        search: 'test',
      };

      const result = await controller.findAll(filters);

      expect(result).toEqual(mockPagination);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated categories', async () => {
      const filters: CategoryFilterDto = {
        page: 1,
        limit: 10,
        status: 'active',
      };

      const result = await controller.findAllPaginated(filters);

      expect(result).toEqual(mockPagination);
      expect(service.findAllPaginated).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        { status: 'active' },
      );
    });

    it('should use default pagination values', async () => {
      const filters: CategoryFilterDto = {
        status: 'active',
      };

      await controller.findAllPaginated(filters);

      expect(service.findAllPaginated).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        { status: 'active' },
      );
    });
  });

  describe('getTree', () => {
    it('should return category tree', async () => {
      const filters: CategoryFilterDto = {
        parentId: 'root',
      };

      const result = await controller.getTree(filters);

      expect(result).toEqual(mockCategoryTree);
      expect(service.getCategoryTree).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should find a category by id', async () => {
      const id = 'category-id';

      const result = await controller.findOne(id);

      expect(result).toEqual(mockCategory);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('findBySlug', () => {
    it('should find a category by slug', async () => {
      const slug = 'test-category';

      const result = await controller.findBySlug(slug);

      expect(result).toEqual(mockCategory);
      expect(service.findBySlug).toHaveBeenCalledWith(slug);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const id = 'category-id';
      const updateCategoryDto: UpdateCategoryDto = {
        name: 'Updated Category',
      };

      const result = await controller.update(id, updateCategoryDto, mockUser);

      expect(result).toEqual(mockCategory);
      expect(service.update).toHaveBeenCalledWith(id, updateCategoryDto, mockUser);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      const id = 'category-id';

      await controller.remove(id, mockUser);

      expect(service.remove).toHaveBeenCalledWith(id, mockUser);
    });
  });
});
