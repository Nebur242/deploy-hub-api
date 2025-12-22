import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

import { MediaType } from '../../entities/media.entity';
import { MediaQueryDto } from '../media-query.dto';

describe('MediaQueryDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = plainToClass(MediaQueryDto, {
      type: MediaType.IMAGE,
      owner_id: '123',
      tags: ['tag1', 'tag2'],
      is_public: true,
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

  it('should fail validation with invalid owner_id', async () => {
    const dto = plainToClass(MediaQueryDto, {
      owner_id: 123, // number instead of string
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should transform string "true" to boolean true', () => {
    const dto = plainToClass(MediaQueryDto, {
      is_public: true,
    });

    expect(dto.is_public).toBe(true);
  });

  it('should transform string "false" to boolean false', () => {
    const dto = plainToClass(MediaQueryDto, {
      is_public: false,
    });

    expect(dto.is_public).toBe(false);
  });
});
