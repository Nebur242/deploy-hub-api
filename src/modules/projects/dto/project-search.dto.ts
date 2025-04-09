// src/projects/dto/project-search.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsEnum, IsArray, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';

import { TechStack, Visibility } from '../entities/project.entity';

/**
 * Data Transfer Object for project search and filtering
 */
export class ProjectSearchDto {
  @ApiProperty({
    description: 'Search term to filter projects by name or description',
    required: false,
    example: 'e-commerce',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by project visibility',
    required: false,
    enum: Visibility,
    example: Visibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiProperty({
    description: 'Filter by technology stack',
    required: false,
    isArray: true,
    enum: TechStack,
    example: [TechStack.REACT, TechStack.NEXTJS],
  })
  @IsOptional()
  @IsEnum(TechStack, { each: true })
  @Transform(({ value }: { value: TechStack[] | TechStack }) => {
    // Handle case when a single string value is passed
    console.log('value', value);
    return Array.isArray(value) ? value : value ? [value] : [];
  })
  techStack?: TechStack[];

  @ApiProperty({
    description: 'Filter by category IDs',
    required: false,
    isArray: true,
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @Transform(({ value }: { value: string | string[] }) => {
    // Handle case when a single string value is passed
    return Array.isArray(value) ? value : value ? [value] : [];
  })
  categoryIds?: string[];

  @ApiProperty({
    description: 'Sort projects by field',
    required: false,
    enum: ['name', 'createdAt', 'updatedAt'],
    default: 'updatedAt',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => {
    const allowedSortFields = ['name', 'createdAt', 'updatedAt'];
    return allowedSortFields.includes(value) ? value : 'updatedAt';
  })
  sortBy?: string = 'updatedAt';

  @ApiProperty({
    description: 'Sort direction',
    required: false,
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    return value === 'ASC' ? 'ASC' : 'DESC';
  })
  sortDirection?: 'ASC' | 'DESC' = 'DESC';

  @ApiProperty({
    description: 'Page number (1-based indexing)',
    required: false,
    type: Number,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @Transform(({ value }: { value: number }) => {
    return value < 1 ? 1 : value;
  })
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    required: true,
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @Transform(({ value }: { value: number }) => {
    return value > 100 ? 100 : value;
  })
  limit: number;
}
