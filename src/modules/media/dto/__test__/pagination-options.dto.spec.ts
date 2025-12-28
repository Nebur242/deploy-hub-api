import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PaginationOptionsDto, Order } from '../pagination-options.dto';

describe('PaginationOptionsDto', () => {
  it('should use default values when no values are provided', () => {
    const dto = new PaginationOptionsDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.sortBy).toBe('created_at');
    expect(dto.order).toBe(Order.DESC);
  });

  it('should accept valid values', () => {
    const dto = plainToInstance(PaginationOptionsDto, {
      page: 5,
      limit: 20,
      sortBy: 'updatedAt',
      order: 'ASC',
    });

    const errors = validateSync(dto);

    expect(errors.length).toBe(0);
    expect(dto.page).toBe(5);
    expect(dto.limit).toBe(20);
    expect(dto.sortBy).toBe('updatedAt');
    expect(dto.order).toBe(Order.ASC);
  });

  it('should reject if page is less than 1', () => {
    const dto = plainToInstance(PaginationOptionsDto, { page: 0 });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('should reject if limit is less than 1', () => {
    const dto = plainToInstance(PaginationOptionsDto, { limit: 0 });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('should reject if limit is greater than 100', () => {
    const dto = plainToInstance(PaginationOptionsDto, { limit: 101 });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('should reject if order has invalid value', () => {
    const dto = plainToInstance(PaginationOptionsDto, { order: 'INVALID' });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should reject if page is not an integer', () => {
    const dto = plainToInstance(PaginationOptionsDto, { page: 1.5 });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });

  it('should reject if limit is not an integer', () => {
    const dto = plainToInstance(PaginationOptionsDto, { limit: 10.5 });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
});
