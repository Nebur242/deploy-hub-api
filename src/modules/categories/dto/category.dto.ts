import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum CategoryStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Category slug for URL', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  slug: string;

  @ApiPropertyOptional({ description: 'Category description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Category icon identifier',
    default: 'default-category-icon',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  icon?: string;

  @ApiPropertyOptional({ description: 'Category image URL' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Parent category ID' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    description: 'Status of the category',
    enum: ['pending', 'active', 'inactive', 'deleted'],
    default: 'pending',
  })
  @IsEnum(CategoryStatus)
  @IsOptional()
  status: 'pending' | 'active' | 'inactive' | 'deleted';

  @ApiPropertyOptional({ description: 'Sorting order', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name', maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ description: 'Category slug for URL', maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Category description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Category image URL' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Category icon identifier' })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  icon?: string;

  @ApiProperty({
    description: 'Status of the category',
    enum: ['pending', 'active', 'inactive', 'deleted'],
    default: 'pending',
  })
  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: 'pending' | 'active' | 'inactive' | 'deleted';

  @ApiPropertyOptional({ description: 'Parent category ID' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Is category active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sorting order' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  image?: string;

  @ApiProperty()
  icon: string;

  @ApiPropertyOptional()
  ownerId?: string;

  @ApiPropertyOptional()
  parentId?: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({
    enum: ['pending', 'active', 'inactive', 'deleted'],
    default: 'active',
  })
  status: `${CategoryStatus}`;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CategoryTreeDto extends CategoryResponseDto {
  @ApiPropertyOptional({ type: [CategoryTreeDto] })
  children?: CategoryTreeDto[];
}

export class CategoryFilterDto {
  @ApiPropertyOptional({ description: 'Filter by parent ID (UUID or "root")' })
  @IsOptional()
  @ValidateIf((o: CategoryFilterDto) => o.parentId !== 'root')
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: `${CategoryStatus}`;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
