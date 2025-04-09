import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from './project.entity';

@Entity('project_versions')
export class ProjectVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

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
