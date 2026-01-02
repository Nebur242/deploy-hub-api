import { ModerationStatus } from '@app/shared/enums';
import { Injectable } from '@nestjs/common';

import { ModerationHistory, ModerationAction } from '../entities/moderation-history.entity';
import {
  ModerationHistoryRepository,
  FindModerationHistoryOptions,
} from '../repositories/moderation-history.repository';

export interface CreateModerationHistoryDto {
  projectId: string;
  action: ModerationAction;
  fromStatus: ModerationStatus;
  toStatus: ModerationStatus;
  note?: string;
  performedBy: string;
  performedByRole: 'admin' | 'owner';
}

@Injectable()
export class ModerationHistoryService {
  constructor(private readonly moderationHistoryRepository: ModerationHistoryRepository) {}

  create(data: CreateModerationHistoryDto): Promise<ModerationHistory> {
    return this.moderationHistoryRepository.create({
      project_id: data.projectId,
      action: data.action,
      from_status: data.fromStatus,
      to_status: data.toStatus,
      note: data.note,
      performed_by: data.performedBy,
      performed_by_role: data.performedByRole,
    });
  }

  findByProject(
    projectId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ items: ModerationHistory[]; total: number }> {
    return this.moderationHistoryRepository.findByProject(projectId, options);
  }

  findAll(
    options?: FindModerationHistoryOptions,
  ): Promise<{ items: ModerationHistory[]; total: number }> {
    return this.moderationHistoryRepository.findAll(options);
  }

  getRecentActivity(limit?: number): Promise<ModerationHistory[]> {
    return this.moderationHistoryRepository.getRecentActivity(limit);
  }
}
