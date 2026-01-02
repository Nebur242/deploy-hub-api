import { ModerationStatus } from '@app/shared/enums';

import { ModerationAction } from '../entities/moderation-history.entity';

export class ModerationEventPayload {
  projectId: string;
  projectName: string;
  action: ModerationAction;
  fromStatus: ModerationStatus;
  toStatus: ModerationStatus;
  note?: string;
  performedBy: string;
  performedByRole: 'admin' | 'owner';
  pendingChanges?: Record<string, unknown>; // For change submissions
  // Owner info for notifications
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
}

export class ProjectSubmittedForReviewEvent extends ModerationEventPayload {
  static readonly eventName = 'project.submitted_for_review';
}

export class ProjectApprovedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.approved';
}

export class ProjectRejectedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.rejected';
}

export class ProjectResubmittedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.resubmitted';
}

export class ProjectChangesSubmittedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.changes_submitted';
}

export class ProjectChangesApprovedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.changes_approved';
}

export class ProjectChangesRejectedEvent extends ModerationEventPayload {
  static readonly eventName = 'project.changes_rejected';
}

export const MODERATION_EVENTS = {
  SUBMITTED_FOR_REVIEW: ProjectSubmittedForReviewEvent.eventName,
  APPROVED: ProjectApprovedEvent.eventName,
  REJECTED: ProjectRejectedEvent.eventName,
  RESUBMITTED: ProjectResubmittedEvent.eventName,
  CHANGES_SUBMITTED: ProjectChangesSubmittedEvent.eventName,
  CHANGES_APPROVED: ProjectChangesApprovedEvent.eventName,
  CHANGES_REJECTED: ProjectChangesRejectedEvent.eventName,
} as const;
