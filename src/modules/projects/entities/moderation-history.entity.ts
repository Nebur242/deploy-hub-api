import { ModerationStatus } from '@app/shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Project } from './project.entity';

export enum ModerationAction {
  SUBMITTED = 'submitted', // Owner submitted for review
  APPROVED = 'approved', // Admin approved
  REJECTED = 'rejected', // Admin rejected
  RESUBMITTED = 'resubmitted', // Owner resubmitted after rejection
  CHANGES_SUBMITTED = 'changes_submitted', // Owner submitted changes to approved project
  CHANGES_APPROVED = 'changes_approved', // Admin approved the changes
  CHANGES_REJECTED = 'changes_rejected', // Admin rejected the changes (keep original)
}

@Entity('moderation_history')
export class ModerationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  @Index()
  project_id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({
    type: 'enum',
    enum: ModerationAction,
  })
  action: ModerationAction;

  @Column({
    type: 'enum',
    enum: ModerationStatus,
  })
  from_status: ModerationStatus;

  @Column({
    type: 'enum',
    enum: ModerationStatus,
  })
  to_status: ModerationStatus;

  @Column({ nullable: true })
  note?: string; // Admin note or owner message

  @Column({ name: 'performed_by' })
  performed_by: string; // User ID (admin or owner)

  @Column({ name: 'performed_by_role' })
  performed_by_role: string; // 'admin' or 'owner'

  @CreateDateColumn()
  created_at: Date;
}
