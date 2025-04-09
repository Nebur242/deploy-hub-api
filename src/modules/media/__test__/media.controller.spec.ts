/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { CreateMediaDto } from '../dto/create-media.dto';
import { MediaResponseDto } from '../dto/media-response.dto';
import { PaginationOptionsDto } from '../dto/pagination-options.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { MediaType } from '../entities/media.entity';
import { MediaController } from '../media.controller';
import { MediaService } from '../media.service';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  const mockMediaService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
  };

  const mockMediaResponse = {
    id: 'media-id-123',
    url: 'http://example.com/image.jpg',
    type: 'image' as MediaType.IMAGE,
    filename: 'image.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
    originalFilename: '',
    mimeType: '',
    size: 0,
    thumbnailUrl: '',
    width: 0,
    height: 0,
    duration: 0,
    alt: '',
    metadata: {},
    isPublic: false,
    tags: [],
    folder: '',
  } as unknown as MediaResponseDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new media record', async () => {
      const createMediaDto: CreateMediaDto = {
        url: 'http://example.com/image.jpg',
        type: 'image' as MediaType.IMAGE,
        filename: 'image.jpg',
        originalFilename: '',
        mimeType: '',
        size: 0,
      };

      mockMediaService.create.mockResolvedValue(mockMediaResponse);

      const result = await controller.create(createMediaDto, mockUser as any);

      expect(service.create).toHaveBeenCalledWith({
        ...createMediaDto,
        ownerId: mockUser.id,
      });
      expect(result).toEqual(mockMediaResponse);
    });
  });

  describe('findAll', () => {
    it('should return an array of media records', async () => {
      const paginationOptions: PaginationOptionsDto = {
        page: 1,
        limit: 10,
      };
      const mediaList = [mockMediaResponse];

      mockMediaService.findAll.mockResolvedValue(mediaList);

      const result = await controller.findAll(paginationOptions);

      expect(service.findAll).toHaveBeenCalledWith(paginationOptions);
      expect(result).toEqual(mediaList);
    });
  });

  describe('findOne', () => {
    it('should return a media record by id', async () => {
      const id = 'media-id-123';

      mockMediaService.findOne.mockResolvedValue(mockMediaResponse);

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockMediaResponse);
    });
  });

  describe('update', () => {
    it('should update a media record', async () => {
      const id = 'media-id-123';
      const updateMediaDto: UpdateMediaDto = {
        filename: 'updated-image.jpg',
      };

      mockMediaService.update.mockResolvedValue({
        ...mockMediaResponse,
        filename: 'updated-image.jpg',
      });

      const result = await controller.update(id, updateMediaDto);

      expect(service.update).toHaveBeenCalledWith(id, updateMediaDto);
      expect(result).toEqual({
        ...mockMediaResponse,
        filename: 'updated-image.jpg',
      });
    });
  });

  describe('remove', () => {
    it('should remove a media record', async () => {
      const id = 'media-id-123';

      mockMediaService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(id);

      expect(service.remove).toHaveBeenCalledWith(id);
      expect(result).toBeUndefined();
    });
  });
});
