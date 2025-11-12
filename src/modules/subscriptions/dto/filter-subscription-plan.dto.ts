import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, Min } from 'class-validator';

import {
  SubscriptionPlanType,
  SubscriptionPlanStatus,
  SubscriptionFeature,
} from '../entities/subscription-plan.entity';

export class FilterSubscriptionPlanDto {
  @ApiPropertyOptional({
    description: 'Search term for plan name or description',
    example: 'Pro',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by plan type',
    enum: SubscriptionPlanType,
    example: SubscriptionPlanType.MONTHLY,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlanType)
  type?: SubscriptionPlanType;

  @ApiPropertyOptional({
    description: 'Filter by plan status',
    enum: SubscriptionPlanStatus,
    example: SubscriptionPlanStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlanStatus)
  status?: SubscriptionPlanStatus;

  @ApiPropertyOptional({
    description: 'Filter by popularity',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  popular?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by active status (maps to status=active)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by billing interval (maps to type field)',
    example: 'month',
    enum: ['month', 'year'],
  })
  @IsOptional()
  @IsEnum(['month', 'year'])
  interval?: 'month' | 'year';

  @ApiPropertyOptional({
    description: 'Filter by feature',
    enum: SubscriptionFeature,
    example: SubscriptionFeature.UNLIMITED_PROJECTS,
  })
  @IsOptional()
  @IsEnum(SubscriptionFeature)
  feature?: SubscriptionFeature;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'price',
    enum: ['name', 'price', 'sortOrder', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsEnum(['name', 'price', 'sortOrder', 'createdAt', 'updatedAt'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortDirection?: 'ASC' | 'DESC';

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
