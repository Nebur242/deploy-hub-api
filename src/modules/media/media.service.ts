import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate, IPaginationMeta, IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';
import { ArrayContains, Like, Repository } from 'typeorm';

import { CreateMediaDto } from './dto/create-media.dto';
import { MediaQueryDto } from './dto/media-query.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { Media } from './entities/media.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
  ) {}

  create(createMediaDto: CreateMediaDto & { ownerId: string }): Promise<Media> {
    const media = this.mediaRepository.create(createMediaDto);
    return this.mediaRepository.save(media);
  }

  findAll(options?: MediaQueryDto): Promise<Pagination<Media, IPaginationMeta>> {
    const paginationOptions: IPaginationOptions = {
      page: options?.page || 1,
      limit: options?.limit || 10,
      route: '/media',
    };

    const queryOptions = {
      where: {
        ...(options?.type && { type: options.type }),
        ...(options?.ownerId && { ownerId: options.ownerId }),
        ...(options?.isPublic !== undefined && { isPublic: options.isPublic }),
        ...(options?.tags && options.tags.length > 0 && { tags: ArrayContains(options.tags) }),
        ...(options?.search && { filename: Like(`%${options.search}%`) }),
      },
      order: {
        [options?.sortBy || 'createdAt']: options?.order || 'DESC',
      },
    };

    return paginate<Media, IPaginationMeta>(this.mediaRepository, paginationOptions, queryOptions);
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return media;
  }

  async update(id: string, updateMediaDto: UpdateMediaDto): Promise<Media> {
    const media = await this.findOne(id);

    // Update media entity
    this.mediaRepository.merge(media, updateMediaDto);
    return this.mediaRepository.save(media);
  }

  async remove(id: string): Promise<void> {
    const media = await this.findOne(id);
    // Delete from database
    await this.mediaRepository.remove(media);
  }
}
