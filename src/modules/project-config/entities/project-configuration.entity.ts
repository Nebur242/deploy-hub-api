import { Project } from '@app/modules/projects/entities/project.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { EnvironmentVariableDto } from '../dto/create-project-configuration.dto';

export enum DeploymentProvider {
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
  CUSTOM = 'custom',
}

@Entity('project_configurations')
export class ProjectConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ name: 'project_id' })
  project_id: string;

  @Column({ type: 'jsonb' })
  github_accounts: {
    username: string;
    access_token: string;
    repository: string;
    workflow_file: string;
  }[];

  @Column({ type: 'jsonb' })
  deployment_option: {
    provider: DeploymentProvider;
    environment_variables: EnvironmentVariableDto[];
  };

  @ManyToOne(() => Project, project => project.configurations, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
