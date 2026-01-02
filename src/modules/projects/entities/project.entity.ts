import { Category } from '@app/modules/categories/entities/category.entity';
import { License } from '@app/modules/license/entities/license.entity';
import { ProjectConfiguration } from '@app/modules/project-config/entities/project-configuration.entity';
import { ProjectVersion } from '@app/modules/project-config/entities/project-version.entity';
import { ModerationStatus } from '@app/shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TechStack {
  REACT = 'react',
  NEXTJS = 'nextjs',
}

export enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FEATURED = 'featured',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'owner_id' })
  owner_id: string;

  @Column({ nullable: false })
  repository: string;

  @Column({ nullable: true })
  preview_url?: string;

  @Column({ nullable: true })
  image?: string;

  @Column({ length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', array: true, default: [] })
  tech_stack: string[];

  @Column({
    type: 'enum',
    enum: Visibility,
    default: Visibility.PRIVATE,
  })
  visibility: Visibility;

  // Moderation fields
  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.DRAFT,
  })
  @Index()
  moderation_status: ModerationStatus;

  @Column({ nullable: true })
  moderation_note?: string; // Admin note explaining rejection or approval conditions

  @Column({ nullable: true })
  moderated_by?: string; // Admin user ID who moderated

  @Column({ nullable: true })
  moderated_at?: Date; // When the moderation decision was made

  @Column({ nullable: true })
  submitted_for_review_at?: Date; // When owner submitted for review

  // Pending changes fields (for approved projects that are edited)
  @Column({ type: 'jsonb', nullable: true })
  pending_changes?: Record<string, unknown> | null; // Stores pending edits waiting for moderation

  @Column({ default: false })
  has_pending_changes: boolean; // Flag to indicate if there are pending changes

  @Column({ type: 'timestamp', nullable: true })
  pending_changes_submitted_at?: Date | null; // When pending changes were submitted for review

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'project_categories',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProjectVersion, version => version.project, {
    cascade: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  versions: ProjectVersion[];

  @OneToMany(() => ProjectConfiguration, config => config.project, {
    cascade: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  configurations: ProjectConfiguration[];

  @ManyToMany(() => License, license => license.projects)
  @JoinTable({
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'license_id', referencedColumnName: 'id' },
  })
  licenses: License[];
}
