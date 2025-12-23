import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from '../dto/category.dto';

describe('Category DTOs', () => {
  describe('CreateCategoryDto', () => {
    // src/modules/categories/__test__/category.dto.test.ts - Add to existing file

    // Add these tests to the CreateCategoryDto describe block
    it('should validate with valid status enum value', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
        slug: 'test-category',
        status: 'active',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid status value', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
        slug: 'test-category',
        status: 'invalid-status',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should validate with image property', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Test Category',
        slug: 'test-category',
        image: 'https://example.com/image.jpg',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    // Add these tests to the CategoryFilterDto describe block
    it('should validate with valid status value', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        status: 'active',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid status value in filter', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        status: 'invalid-status',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should validate with all status values from enum', async () => {
      for (const status of ['pending', 'active', 'inactive', 'deleted']) {
        const dto = plainToInstance(CategoryFilterDto, { status });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
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
        parent_id: '123e4567-e89b-12d3-a456-426614174001',
        is_active: true,
        sort_order: 5,
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
        parent_id: '123e4567-e89b-12d3-a456-426614174001',
        is_active: false,
        sort_order: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if sort_order is negative', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {
        sort_order: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort_order');
    });
  });

  describe('CategoryFilterDto', () => {
    it('should validate a default filter DTO', async () => {
      const dto = plainToInstance(CategoryFilterDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a "root" parent_id', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parent_id: 'root',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate a UUID parent_id', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parent_id: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if parent_id is not "root" or UUID', async () => {
      const dto = plainToInstance(CategoryFilterDto, {
        parent_id: 'invalid-parent',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('parent_id');
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
