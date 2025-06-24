import { Currency } from '@app/shared/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';

import { LicenseStatus } from '../entities/license-option.entity';

export class FilterLicenseDto {
  @ApiPropertyOptional({
    description: 'Search term for name or description',
    example: 'Enterprise',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by license status',
    enum: LicenseStatus,
    example: LicenseStatus.PUBLIC,
  })
  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @ApiPropertyOptional({
    description: 'Filter by currency',
    enum: Currency,
    example: Currency.USD,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'price',
    enum: ['name', 'price', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsEnum(['name', 'price', 'createdAt', 'updatedAt'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortDirection?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Filter by popularity status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  popular?: boolean;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
