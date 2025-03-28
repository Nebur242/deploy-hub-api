import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { MediaType } from '../entities/media.entity';

class OwnerDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  readonly id: string;
}

export class MediaResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  readonly id: string;

  @ApiProperty({ example: 'profile-photo-123456.jpg' })
  readonly filename: string;

  @ApiProperty({ example: 'profile-photo.jpg' })
  readonly originalFilename: string;

  @ApiProperty({ example: 'image/jpeg' })
  readonly mimeType: string;

  @ApiProperty({ enum: MediaType, example: MediaType.IMAGE })
  readonly type: MediaType;

  @ApiProperty({ example: 1024 })
  readonly size: number;

  @ApiProperty({ example: 'https://storage.googleapis.com/bucket-name/path/to/file.jpg' })
  readonly url: string;

  @ApiPropertyOptional({
    example: 'https://storage.googleapis.com/bucket-name/path/to/thumbnail.jpg',
  })
  readonly thumbnailUrl: string;

  @ApiPropertyOptional({ example: 1920 })
  readonly width: number;

  @ApiPropertyOptional({ example: 1080 })
  readonly height: number;

  @ApiPropertyOptional({ example: 120 })
  readonly duration: number;

  @ApiPropertyOptional({ example: 'Profile photo' })
  readonly alt: string;

  @ApiPropertyOptional({ example: { author: 'John Doe' } })
  readonly metadata: Record<string, string>;

  @ApiProperty({ example: true })
  readonly isPublic: boolean;

  @ApiPropertyOptional()
  @Type(() => OwnerDto)
  readonly owner: OwnerDto;

  @ApiProperty({ example: ['profile', 'avatar'] })
  readonly tags: string[];

  @ApiPropertyOptional({ example: 'profile-images' })
  readonly folder: string;

  @ApiProperty({ example: '2023-01-01T12:00:00Z' })
  readonly createdAt: Date;

  @ApiProperty({ example: '2023-01-01T12:00:00Z' })
  readonly updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page', example: 1 })
  readonly currentPage: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  readonly itemsPerPage: number;

  @ApiProperty({ description: 'Total items', example: 100 })
  readonly totalItems: number;

  @ApiProperty({ description: 'Total pages', example: 10 })
  readonly totalPages: number;

  @ApiProperty({ description: 'Has previous page', example: false })
  readonly hasPreviousPage: boolean;

  @ApiProperty({ description: 'Has next page', example: true })
  readonly hasNextPage: boolean;
}

export class PaginatedMediaResponseDto {
  @ApiProperty({ type: [MediaResponseDto] })
  readonly items: MediaResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  readonly meta: PaginationMetaDto;

  @ApiProperty({
    description: 'Links for navigation',
    example: { first: '...', previous: '...', next: '...', last: '...' },
  })
  readonly links: {
    first: string;
    previous: string;
    next: string;
    last: string;
  };
}
