import { Media } from '@app/modules/media/entities/media.entity';
import { User } from '@app/modules/users/entities/user.entity';

import { Category } from '../category.entity';

describe('Category Entity', () => {
  let category: Category;

  beforeEach(() => {
    category = new Category();
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
      'media',
      'mediaId',
      'ownerId',
      'owner',
      'parentId',
      'parent',
      'children',
      'isActive',
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
    expect(category.isActive).toBeUndefined(); // Will be set to true by DB
    expect(category.sortOrder).toBeUndefined(); // Will be set to 0 by DB
  });

  it('should allow setting and getting properties', () => {
    const testId = 'test-uuid';
    const testName = 'Test Category';
    const testSlug = 'test-category';
    const testDescription = 'Test description';
    const testIsActive = false;

    category.id = testId;
    category.name = testName;
    category.slug = testSlug;
    category.description = testDescription;
    category.isActive = testIsActive;

    expect(category.id).toEqual(testId);
    expect(category.name).toEqual(testName);
    expect(category.slug).toEqual(testSlug);
    expect(category.description).toEqual(testDescription);
    expect(category.isActive).toEqual(testIsActive);
  });

  it('should allow setting related entities', () => {
    const media = new Media();
    const user = new User();
    const parentCategory = new Category();
    const childCategory = new Category();

    category.media = media;
    category.owner = user;
    category.parent = parentCategory;
    category.children = [childCategory];

    expect(category.media).toEqual(media);
    expect(category.owner).toEqual(user);
    expect(category.parent).toEqual(parentCategory);
    expect(category.children).toContain(childCategory);
  });
});
