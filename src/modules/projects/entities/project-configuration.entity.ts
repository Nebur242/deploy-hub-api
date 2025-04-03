import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';

import { Project } from './project.entity';

export enum DeploymentProvider {
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure',
}

@Entity('project_configurations')
export class ProjectConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'jsonb', nullable: true })
  githubAccounts: {
    id: string;
    username: string;
    accessToken: string;
    repositories: string[];
  }[];

  @Column({ type: 'jsonb', nullable: true })
  deploymentOptions: {
    provider: DeploymentProvider;
    configTemplate: string;
  }[];

  @Column({ type: 'text', array: true, default: [] })
  buildCommands: string[];

  @Column({ type: 'jsonb', nullable: true })
  environmentVariables: {
    key: string;
    defaultValue: string;
    isRequired: boolean;
    isSecret: boolean;
  }[];

  @ManyToOne(() => Project, project => project.configurations)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
