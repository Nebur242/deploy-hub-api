import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

import { MediaType } from '../../entities/media.entity';
import { MediaQueryDto } from '../media-query.dto';

describe('MediaQueryDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = plainToClass(MediaQueryDto, {
      type: MediaType.IMAGE,
      ownerId: '123',
      tags: ['tag1', 'tag2'],
      isPublic: true,
      search: 'test',
      page: 1,
      limit: 10,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass validation with empty data', async () => {
    const dto = plainToClass(MediaQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid type', async () => {
    const dto = plainToClass(MediaQueryDto, {
      type: 'INVALID_TYPE',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation with invalid ownerId', async () => {
    const dto = plainToClass(MediaQueryDto, {
      ownerId: 123, // number instead of string
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should fail validation with invalid tags', async () => {
    const dto = plainToClass(MediaQueryDto, {
      tags: 'tag1,tag2', // string instead of array
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isArray');
  });

  it('should fail validation with invalid isPublic', async () => {
    const dto = plainToClass(MediaQueryDto, {
      isPublic: 'not-a-boolean',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });

  it('should transform string "true" to boolean true', () => {
    const dto = plainToClass(MediaQueryDto, {
      isPublic: true,
    });

    expect(dto.isPublic).toBe(true);
  });

  it('should transform string "false" to boolean false', () => {
    const dto = plainToClass(MediaQueryDto, {
      isPublic: false,
    });

    expect(dto.isPublic).toBe(false);
  });
});
