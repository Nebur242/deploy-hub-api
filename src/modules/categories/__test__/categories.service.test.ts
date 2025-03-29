/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
import { User } from '@app/modules/users/entities/user.entity';
import { Role } from '@app/shared/enums';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategoryService } from '../categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import { Category } from '../entities/category.entity';

// Mock paginate function
jest.mock('nestjs-typeorm-paginate', () => ({
  paginate: jest
    .fn()
    .mockImplementation((repository, options: { page: number; limit: number }, _query?) => {
      return Promise.resolve({
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: options.limit,
          totalPages: 0,
          currentPage: options.page,
        },
      });
    }),
}));

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: jest.Mocked<Repository<Category>>;

  const mockCategoryRepository = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    })),
  });

  const mockUser: User = {
    id: 'user-id',
    roles: [Role.USER],
    username: 'testuser',
    email: 'test@example.com',
  } as any as User;

  const mockAdminUser: User = {
    id: 'admin-id',
    roles: [Role.ADMIN],
    username: 'adminuser',
    email: 'admin@example.com',
  } as any as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useFactory: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepository = module.get(getRepositoryToken(Category));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category successfully', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description',
        status: 'pending',
      };

      const createdCategory = { ...createCategoryDto, id: 'category-id', ownerId: mockUser.id };

      categoryRepository.findOne.mockResolvedValue(null);
      categoryRepository.create.mockReturnValue(createdCategory as any);
      categoryRepository.save.mockResolvedValue(createdCategory as any);

      const result = await service.create(createCategoryDto, mockUser);

      expect(categoryRepository.findOne).toHaveBeenCalled();
      expect(categoryRepository.create).toHaveBeenCalledWith({
        ...createCategoryDto,
        ownerId: mockUser.id,
      });
      expect(categoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdCategory);
    });

    it('should throw conflict exception if category with same name exists', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
        status: 'pending',
      };

      const existingCategory = {
        id: 'existing-id',
        name: 'Test Category',
        slug: 'existing-slug',
      };

      categoryRepository.findOne.mockResolvedValue(existingCategory as any);

      await expect(service.create(createCategoryDto, mockUser)).rejects.toThrow(ConflictException);
      expect(categoryRepository.findOne).toHaveBeenCalled();
    });

    it('should validate parent category if provided', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
        parentId: 'parent-id',
        status: 'pending',
      };

      categoryRepository.findOne.mockResolvedValueOnce(null);
      categoryRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(createCategoryDto, mockUser)).rejects.toThrow(NotFoundException);

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'parent-id' },
      });
    });

    it('should create a category with specified status', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
        status: 'inactive',
      };

      const createdCategory = {
        ...createCategoryDto,
        id: 'category-id',
        ownerId: mockUser.id,
      };

      categoryRepository.findOne.mockResolvedValue(null);
      categoryRepository.create.mockReturnValue(createdCategory as any);
      categoryRepository.save.mockResolvedValue(createdCategory as any);

      const result = await service.create(createCategoryDto, mockUser);

      expect(categoryRepository.create).toHaveBeenCalledWith({
        ...createCategoryDto,
        ownerId: mockUser.id,
      });
      expect(result.status).toEqual('inactive');
    });
  });

  describe('findBySlug', () => {
    it('should find active category by slug', async () => {
      const mockCategory = { id: 'test-id', slug: 'test-slug', status: 'active' };
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);

      const result = await service.findBySlug('test-slug');

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug', status: 'active' },
        relations: ['parent'],
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category not found by slug', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent-slug')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should find a category by id', async () => {
      const mockCategory = { id: 'test-id', name: 'Test Category' };
      categoryRepository.findOne.mockResolvedValue(mockCategory as any);

      const result = await service.findOne('test-id');

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        relations: ['parent', 'children'],
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a category successfully', async () => {
      const updateCategoryDto: UpdateCategoryDto = { name: 'Updated Category' };
      const existingCategory = {
        id: 'test-id',
        name: 'Test Category',
        ownerId: mockUser.id,
      };
      const updatedCategory = { ...existingCategory, ...updateCategoryDto };

      categoryRepository.findOne.mockResolvedValueOnce(existingCategory as any);
      categoryRepository.findOne.mockResolvedValueOnce(null); // No conflict check
      categoryRepository.save.mockResolvedValue(updatedCategory as any);

      const result = await service.update('test-id', updateCategoryDto, mockUser);

      expect(categoryRepository.save).toHaveBeenCalledWith(updatedCategory);
      expect(result).toEqual(updatedCategory);
    });

    it('should throw ForbiddenException if user has no permission', async () => {
      const updateCategoryDto: UpdateCategoryDto = { name: 'Updated Category' };
      const existingCategory = {
        id: 'test-id',
        name: 'Test Category',
        ownerId: 'different-user-id',
      };

      categoryRepository.findOne.mockResolvedValue(existingCategory as any);

      await expect(service.update('test-id', updateCategoryDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to update any category', async () => {
      const updateCategoryDto: UpdateCategoryDto = { name: 'Updated Category' };
      const existingCategory = {
        id: 'test-id',
        name: 'Test Category',
        ownerId: 'different-user-id',
      };
      const updatedCategory = { ...existingCategory, ...updateCategoryDto };

      categoryRepository.findOne.mockResolvedValueOnce(existingCategory as any);
      categoryRepository.findOne.mockResolvedValueOnce(null); // No conflict check
      categoryRepository.save.mockResolvedValue(updatedCategory as any);

      const result = await service.update('test-id', updateCategoryDto, mockAdminUser);

      expect(categoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedCategory);
    });

    it('should update category status', async () => {
      const updateCategoryDto: UpdateCategoryDto = { status: 'inactive' };
      const existingCategory = {
        id: 'test-id',
        name: 'Test Category',
        status: 'active',
        ownerId: mockUser.id,
      };
      const updatedCategory = { ...existingCategory, ...updateCategoryDto };

      categoryRepository.findOne.mockResolvedValueOnce(existingCategory as any);
      categoryRepository.findOne.mockResolvedValueOnce(null); // No conflict check
      categoryRepository.save.mockResolvedValue(updatedCategory as any);

      const result = await service.update('test-id', updateCategoryDto, mockUser);

      expect(categoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'inactive',
        }),
      );
      expect(result.status).toEqual('inactive');
    });
  });

  describe('remove', () => {
    it('should remove a category successfully', async () => {
      const mockCategory = { id: 'test-id', ownerId: mockUser.id };

      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      categoryRepository.count.mockResolvedValue(0); // No children
      categoryRepository.remove.mockResolvedValue(undefined as any);

      await service.remove('test-id', mockUser);

      expect(categoryRepository.remove).toHaveBeenCalledWith(mockCategory);
    });

    it('should throw ConflictException if category has children', async () => {
      const mockCategory = { id: 'test-id', ownerId: mockUser.id };

      categoryRepository.findOne.mockResolvedValue(mockCategory as any);
      categoryRepository.count.mockResolvedValue(1); // Has children

      await expect(service.remove('test-id', mockUser)).rejects.toThrow(ConflictException);

      expect(categoryRepository.remove).not.toHaveBeenCalled();
    });
  });
});
