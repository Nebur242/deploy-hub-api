import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MODERATION_EVENTS, ModerationEventPayload } from '../events/moderation.events';
import { ModerationHistoryService } from '../services/moderation-history.service';

@Injectable()
export class ModerationEventListener {
  private readonly logger = new Logger(ModerationEventListener.name);

  constructor(private readonly moderationHistoryService: ModerationHistoryService) {}

  @OnEvent(MODERATION_EVENTS.SUBMITTED_FOR_REVIEW, { async: true })
  async handleProjectSubmittedForReview(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'submitted_for_review');
  }

  @OnEvent(MODERATION_EVENTS.APPROVED, { async: true })
  async handleProjectApproved(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'approved');
  }

  @OnEvent(MODERATION_EVENTS.REJECTED, { async: true })
  async handleProjectRejected(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'rejected');
  }

  @OnEvent(MODERATION_EVENTS.RESUBMITTED, { async: true })
  async handleProjectResubmitted(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'resubmitted');
  }

  @OnEvent(MODERATION_EVENTS.CHANGES_SUBMITTED, { async: true })
  async handleProjectChangesSubmitted(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'changes_submitted');
  }

  @OnEvent(MODERATION_EVENTS.CHANGES_APPROVED, { async: true })
  async handleProjectChangesApproved(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'changes_approved');
  }

  @OnEvent(MODERATION_EVENTS.CHANGES_REJECTED, { async: true })
  async handleProjectChangesRejected(payload: ModerationEventPayload) {
    await this.recordModerationHistory(payload, 'changes_rejected');
  }

  private async recordModerationHistory(payload: ModerationEventPayload, eventType: string) {
    try {
      await this.moderationHistoryService.create({
        projectId: payload.projectId,
        action: payload.action,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        note: payload.note,
        performedBy: payload.performedBy,
        performedByRole: payload.performedByRole,
      });

      this.logger.log(`Recorded moderation history: ${eventType} for project ${payload.projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record moderation history for project ${payload.projectId}`,
        error,
      );
    }
  }
}
