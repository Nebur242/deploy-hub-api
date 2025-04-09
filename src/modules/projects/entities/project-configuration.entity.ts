import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from './project.entity';
import { EnvironmentVariableDto } from '../dto/create-project-configuration.dto';

export enum DeploymentProvider {
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
}

@Entity('project_configurations')
export class ProjectConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'jsonb' })
  githubAccounts: {
    username: string;
    accessToken: string;
    repository: string;
    workflowFile: string;
  }[];

  @Column({ type: 'jsonb' })
  deploymentOption: {
    provider: DeploymentProvider;
    environmentVariables: EnvironmentVariableDto[];
  };

  @ManyToOne(() => Project, project => project.configurations, {
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
