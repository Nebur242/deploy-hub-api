import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate, IPaginationMeta } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { CreateMediaDto } from './dto/create-media.dto';
import { PaginationOptionsDto } from './dto/pagination-options.dto';
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

  findAll(options?: PaginationOptionsDto) {
    const queryBuilder = this.mediaRepository
      .createQueryBuilder('media')
      .leftJoinAndSelect('media.owner', 'owner');

    if (options?.sortBy) {
      queryBuilder.orderBy(`media.${options.sortBy}`, options.order);
    } else {
      queryBuilder.orderBy('media.createdAt', 'DESC');
    }

    return paginate<Media, IPaginationMeta>(queryBuilder, {
      page: options?.page || 1,
      limit: options?.limit || 10,
      route: '/media',
    });
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
