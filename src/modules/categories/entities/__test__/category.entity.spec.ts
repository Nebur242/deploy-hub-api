import { User } from '@app/modules/users/entities/user.entity';

import { Category } from '../category.entity';

describe('Category Entity', () => {
  let category: Category;

  beforeEach(() => {
    category = new Category();
  });

  // src/modules/categories/entities/__test__/category.entity.spec.ts - Add to existing file

  it('should have status property', () => {
    expect(category).toHaveProperty('status');
  });

  it('should handle status property', () => {
    const testStatus = 'active';
    category.status = testStatus;
    expect(category.status).toEqual(testStatus);
  });

  it('should handle image property', () => {
    const testImage = 'https://example.com/test.jpg';
    category.image = testImage;
    expect(category.image).toEqual(testImage);
  });

  it('should create a category instance', () => {
    expect(category).toBeDefined();
  });

  it('should have id property', () => {
    expect(category).toHaveProperty('id');
  });

  it('should have required properties', () => {
    const requiredProperties = [
      'id',
      'name',
      'slug',
      'description',
      'icon',
      'ownerId',
      'owner',
      'parentId',
      'parent',
      'children',
      'sortOrder',
      'createdAt',
      'updatedAt',
    ];

    requiredProperties.forEach(prop => {
      expect(category).toHaveProperty(prop);
    });
  });

  it('should have default values', () => {
    expect(category.icon).toBeUndefined(); // Will be set to 'default-category-icon' by DB
    expect(category.sortOrder).toBeUndefined(); // Will be set to 0 by DB
  });

  it('should allow setting and getting properties', () => {
    const testId = 'test-uuid';
    const testName = 'Test Category';
    const testSlug = 'test-category';
    const testDescription = 'Test description';

    category.id = testId;
    category.name = testName;
    category.slug = testSlug;
    category.description = testDescription;

    expect(category.id).toEqual(testId);
    expect(category.name).toEqual(testName);
    expect(category.slug).toEqual(testSlug);
    expect(category.description).toEqual(testDescription);
  });

  it('should allow setting related entities', () => {
    const user = new User();
    const parentCategory = new Category();
    const childCategory = new Category();

    category.owner = user;
    category.parent = parentCategory;
    category.children = [childCategory];

    expect(category.owner).toEqual(user);
    expect(category.parent).toEqual(parentCategory);
    expect(category.children).toContain(childCategory);
  });
});
