import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsBoolean, IsArray } from 'class-validator';

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
  readonly owner_id?: string;

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)' })
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : value.split(','),
  )
  @IsArray()
  readonly tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly is_public?: boolean;

  @ApiPropertyOptional({ description: 'Search term for filename or alt text' })
  @IsString()
  @IsOptional()
  readonly search?: string;
}
