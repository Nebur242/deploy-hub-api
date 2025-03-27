import { plainToClass } from 'class-transformer';

import { MediaType } from '../../entities/media.entity';
import {
  MediaResponseDto,
  PaginationMetaDto,
  PaginatedMediaResponseDto,
} from '../media-response.dto';

describe('MediaResponseDto', () => {
  it('should create a valid media response DTO', () => {
    const mediaData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'profile-photo-123456.jpg',
      originalFilename: 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      type: MediaType.IMAGE,
      size: 1024,
      url: 'https://storage.googleapis.com/bucket-name/path/to/file.jpg',
      thumbnailUrl: 'https://storage.googleapis.com/bucket-name/path/to/thumbnail.jpg',
      width: 1920,
      height: 1080,
      duration: 120,
      alt: 'Profile photo',
      metadata: { author: 'John Doe' },
      isPublic: true,
      owner: { id: '550e8400-e29b-41d4-a716-446655440000' },
      tags: ['profile', 'avatar'],
      folder: 'profile-images',
      createdAt: new Date('2023-01-01T12:00:00Z'),
      updatedAt: new Date('2023-01-01T12:00:00Z'),
    };

    const mediaDto = plainToClass(MediaResponseDto, mediaData);
    expect(mediaDto).toBeInstanceOf(MediaResponseDto);
    expect(mediaDto).toEqual(expect.objectContaining(mediaData));
  });
});

describe('PaginationMetaDto', () => {
  it('should create a valid pagination meta DTO', () => {
    const paginationData = {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 100,
      totalPages: 10,
      hasPreviousPage: false,
      hasNextPage: true,
    };

    const paginationDto = plainToClass(PaginationMetaDto, paginationData);
    expect(paginationDto).toBeInstanceOf(PaginationMetaDto);
    expect(paginationDto).toEqual(expect.objectContaining(paginationData));
  });
});

describe('PaginatedMediaResponseDto', () => {
  it('should create a valid paginated media response DTO', () => {
    const mediaItem = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'profile-photo-123456.jpg',
      originalFilename: 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      type: MediaType.IMAGE,
      size: 1024,
      url: 'https://storage.googleapis.com/bucket-name/path/to/file.jpg',
      isPublic: true,
      tags: ['profile', 'avatar'],
      createdAt: new Date('2023-01-01T12:00:00Z'),
      updatedAt: new Date('2023-01-01T12:00:00Z'),
    };

    const paginatedData = {
      items: [mediaItem],
      meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 100,
        totalPages: 10,
        hasPreviousPage: false,
        hasNextPage: true,
      },
      links: {
        first: '/media?page=1&limit=10',
        previous: '',
        next: '/media?page=2&limit=10',
        last: '/media?page=10&limit=10',
      },
    };

    const paginatedDto = plainToClass(PaginatedMediaResponseDto, paginatedData);
    expect(paginatedDto).toBeInstanceOf(PaginatedMediaResponseDto);
    expect(paginatedDto.items.length).toBe(1);
    expect(paginatedDto.meta).toEqual(expect.objectContaining(paginatedData.meta));
    expect(paginatedDto.links).toEqual(paginatedData.links);
  });
});
