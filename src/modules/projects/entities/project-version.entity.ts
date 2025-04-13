import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

import { Project } from './project.entity';

@Entity('project_versions')
@Unique(['projectId', 'version']) // Ensure version uniqueness within a project
export class ProjectVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  /**
   * Version string (e.g., "1.0.0").
   * Recommended to follow semantic versioning (X.Y.Z) pattern.
   * Note: Consider adding validation in the DTO or service layer with a regex pattern:
   * /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
   */
  @Column()
  version: string;

  @Column({ name: 'release_notes', type: 'text', nullable: true })
  releaseNotes: string;

  @Column({ name: 'commit_hash', nullable: true })
  commitHash: string;

  @Column({ name: 'is_latest', default: true })
  isLatest: boolean;

  @Column({ name: 'is_stable', default: false })
  isStable: boolean;

  @ManyToOne(() => Project, project => project.versions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
