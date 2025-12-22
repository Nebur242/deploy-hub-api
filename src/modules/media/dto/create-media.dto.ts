import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  IsArray,
  IsNumber,
  IsObject,
} from 'class-validator';

import { MediaType } from '../entities/media.entity';

export class CreateMediaDto {
  @ApiProperty({
    description: 'filename that can be edited by the user',
    example: 'my profile photo',
  })
  @IsString()
  readonly filename: string;

  @ApiProperty({ description: 'Original filename', example: 'profile-photo.jpg' })
  @IsString()
  readonly original_filename: string;

  @ApiProperty({ description: 'MIME type', example: 'image/jpeg' })
  @IsString()
  readonly mime_type: string;

  @ApiProperty({ enum: MediaType, description: 'Media type', example: MediaType.IMAGE })
  @IsEnum(MediaType)
  readonly type: MediaType;

  @ApiProperty({ description: 'File size in bytes', example: 1024 })
  @IsNumber()
  readonly size: number;

  @ApiProperty({ description: 'File URL', example: 'https://example.com/image.jpg' })
  @IsString()
  readonly url: string;

  @ApiPropertyOptional({
    description: 'Thumbnail URL',
    example: 'https://example.com/thumbnail.jpg',
  })
  @IsString()
  @IsOptional()
  readonly thumbnail_url?: string;

  @ApiPropertyOptional({ description: 'Width (for images/videos)', example: 1920 })
  @IsNumber()
  @IsOptional()
  readonly width?: number;

  @ApiPropertyOptional({ description: 'Height (for images/videos)', example: 1080 })
  @IsNumber()
  @IsOptional()
  readonly height?: number;

  @ApiPropertyOptional({ description: 'Duration in seconds (for audio/video)', example: 120 })
  @IsNumber()
  @IsOptional()
  readonly duration?: number;

  @ApiPropertyOptional({ description: 'Alt text', example: 'Profile photo' })
  @IsString()
  @IsOptional()
  readonly alt?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', example: { author: 'John Doe' } })
  @IsObject()
  @IsOptional()
  readonly metadata?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Is publicly accessible', example: true })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly is_public?: boolean = true;

  @ApiPropertyOptional({ description: 'Tags', example: ['profile', 'avatar'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  readonly tags?: string[] = [];
}
