import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from '../dto/category.dto';

describe('Category DTOs', () => {
  describe('CreateCategoryDto', () => {
    it('should validate a valid DTO', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
        slug: 'test-category',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a complete valid DTO', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
        slug: 'test-category',
        description: 'A test category description',
        icon: 'test-icon',
        parentId: '123e4567-e89b-12d3-a456-426614174001',
        isActive: true,
        sortOrder: 5,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if name is missing', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        slug: 'test-category',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should fail if slug is missing', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail if name exceeds max length', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'A'.repeat(101),
        slug: 'test-slug',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });
  });

  describe('UpdateCategoryDto', () => {
    it('should validate an empty update DTO', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a complete valid update DTO', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {
        name: 'Updated Category',
        slug: 'updated-category',
        description: 'Updated description',
        icon: 'updated-icon',
        mediaId: '123e4567-e89b-12d3-a456-426614174000',
        parentId: '123e4567-e89b-12d3-a456-426614174001',
        isActive: false,
        sortOrder: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if sortOrder is negative', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {
        sortOrder: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sortOrder');
    });
  });

  describe('CategoryFilterDto', () => {
    it('should validate a default filter DTO', async () => {
      const dto = plainToInstance(CategoryFilterDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a "root" parentId', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parentId: 'root',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a UUID parentId', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parentId: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if parentId is not "root" or UUID', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parentId: 'invalid-parent',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('parentId');
    });

    it('should fail if page is less than 1', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        page: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should fail if limit is less than 1', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        limit: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });
  });
});
