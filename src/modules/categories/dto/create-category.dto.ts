import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Web Development' })
  @IsString()
  readonly name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Projects related to web development',
  })
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiPropertyOptional({ description: 'Category icon', example: 'code-icon' })
  @IsString()
  @IsOptional()
  readonly icon?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  readonly parentId?: string;

  @ApiPropertyOptional({ description: 'Category active status', example: true })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly isActive?: boolean;

  @ApiPropertyOptional({ description: 'Category sort order', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  readonly sortOrder?: number;
}
