import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ModerationHistory } from '../entities/moderation-history.entity';

export interface FindModerationHistoryOptions {
  projectId?: string;
  performedBy?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ModerationHistoryRepository {
  constructor(
    @InjectRepository(ModerationHistory)
    private readonly repository: Repository<ModerationHistory>,
  ) {}

  create(data: Partial<ModerationHistory>): Promise<ModerationHistory> {
    const entry = this.repository.create(data);
    return this.repository.save(entry);
  }

  async findByProject(
    projectId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: ModerationHistory[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [items, total] = await this.repository.findAndCount({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total };
  }

  async findAll(
    options: FindModerationHistoryOptions = {},
  ): Promise<{ items: ModerationHistory[]; total: number }> {
    const { projectId, performedBy, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.project', 'project')
      .orderBy('history.created_at', 'DESC');

    if (projectId) {
      queryBuilder.andWhere('history.project_id = :projectId', { projectId });
    }

    if (performedBy) {
      queryBuilder.andWhere('history.performed_by = :performedBy', { performedBy });
    }

    const [items, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return { items, total };
  }

  getRecentActivity(limit: number = 10): Promise<ModerationHistory[]> {
    return this.repository.find({
      relations: ['project'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
