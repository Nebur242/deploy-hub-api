/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as paginateModule from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { CreateMediaDto } from '../dto/create-media.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { Media, MediaType } from '../entities/media.entity';
import { MediaService } from '../media.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  paginate: jest.fn(),
}));

describe('MediaService', () => {
  let service: MediaService;
  let repository: Repository<Media>;

  const mockMediaRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: getRepositoryToken(Media),
          useFactory: mockMediaRepository,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    repository = module.get<Repository<Media>>(getRepositoryToken(Media));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new media item', async () => {
      const createMediaDto: CreateMediaDto & { owner_id: string } = {
        url: 'http://example.com/test.jpg',
        type: 'image' as MediaType.IMAGE,
        owner_id: 'user-123',
        filename: 'test.jpg',
        original_filename: 'original-test.jpg',
        mime_type: 'image/jpeg',
        size: 1024,
      };
      const mediaEntity = { id: 'media-123', ...createMediaDto } as Media;

      jest.spyOn(repository, 'create').mockReturnValue(mediaEntity);
      jest.spyOn(repository, 'save').mockResolvedValue(mediaEntity);

      const result = await service.create(createMediaDto);

      expect(repository.create).toHaveBeenCalledWith(createMediaDto);
      expect(repository.save).toHaveBeenCalledWith(mediaEntity);
      expect(result).toEqual(mediaEntity);
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default options', async () => {
      const paginationResult = {
        items: [],
        meta: { currentPage: 1, itemCount: 0, totalItems: 0, totalPages: 0 },
      };

      (paginateModule.paginate as jest.Mock).mockResolvedValue(paginationResult);

      const result = await service.findAll();

      expect(paginateModule.paginate).toHaveBeenCalledWith(
        repository,
        {
          page: 1,
          limit: 10,
          route: '/media',
        },
        { where: {}, order: { created_at: 'DESC' } },
      );
      expect(result).toEqual(paginationResult);
    });

    it('should return paginated results with provided options', async () => {
      const options = { page: 2, limit: 20 };
      const paginationResult = {
        items: [],
        meta: { currentPage: 2, itemCount: 0, totalItems: 0, totalPages: 0 },
      };

      (paginateModule.paginate as jest.Mock).mockResolvedValue(paginationResult);

      const result = await service.findAll(options);

      expect(paginateModule.paginate).toHaveBeenCalledWith(
        repository,
        {
          page: 2,
          limit: 20,
          route: '/media',
        },
        { where: {}, order: { created_at: 'DESC' } },
      );
      expect(result).toEqual(paginationResult);
    });
  });

  describe('findOne', () => {
    it('should return a media item if found', async () => {
      const mediaItem = {
        id: 'media-123',
        title: 'Test Media',
        owner: { id: 'user-123', name: 'Test User' },
      } as unknown as Media;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mediaItem);

      const result = await service.findOne('media-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'media-123' },
        relations: ['owner'],
      });
      expect(result).toEqual(mediaItem);
    });

    it('should throw NotFoundException if media is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        new NotFoundException('Media with ID non-existent not found'),
      );
    });
  });

  describe('update', () => {
    it('should update and return the media item', async () => {
      const mediaId = 'media-123';
      const updateMediaDto: UpdateMediaDto = { alt: 'Updated alt text' };
      const existingMedia = {
        id: mediaId,
        url: 'https://example.com/image.jpg',
      } as unknown as Media;
      const updatedMedia = {
        id: mediaId,
        url: 'https://example.com/image.jpg',
        alt: 'Updated alt text',
      } as unknown as Media;

      jest.spyOn(service, 'findOne').mockResolvedValue(existingMedia);
      jest.spyOn(repository, 'merge').mockReturnValue(updatedMedia);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedMedia);

      const result = await service.update(mediaId, updateMediaDto);

      expect(service.findOne).toHaveBeenCalled();
      expect(expect(service.findOne).toHaveBeenCalledWith(mediaId));
      expect(repository.merge).toHaveBeenCalled();
      expect(expect(repository.merge).toHaveBeenCalledWith(existingMedia, updateMediaDto));
      expect(repository.save).toHaveBeenCalled();
      //   expect(expect(repository.save).toHaveBeenCalledWith(updatedMedia));
      expect(result).toEqual(updatedMedia);
    });
  });

  describe('remove', () => {
    it('should remove the media item', async () => {
      const mediaId = 'media-123';
      const mediaItem = { id: mediaId } as Media;

      jest.spyOn(service, 'findOne').mockResolvedValue(mediaItem);
      jest.spyOn(repository, 'remove').mockResolvedValue(undefined as any);

      await service.remove(mediaId);

      expect(service.findOne).toHaveBeenCalledWith(mediaId);
      expect(repository.remove).toHaveBeenCalledWith(mediaItem);
    });
  });
});
