import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';

import { PaginationOptionsDto } from './pagination-options.dto';
import { MediaType } from '../entities/media.entity';

export class MediaQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ enum: MediaType, description: 'Filter by media type' })
  @IsEnum(MediaType)
  @IsOptional()
  readonly type?: MediaType;

  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @IsString()
  @IsOptional()
  readonly ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  readonly tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  readonly isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Search term for filename or alt text' })
  @IsString()
  @IsOptional()
  readonly search?: string;
}
