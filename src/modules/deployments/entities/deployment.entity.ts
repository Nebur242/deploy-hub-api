import { License } from '@app/modules/license/entities/license.entity';
import { UserLicense } from '@app/modules/license/entities/user-license.entity';
import { EnvironmentVariableDto } from '@app/modules/project-config/dto/create-project-configuration.dto';
import { ProjectConfiguration } from '@app/modules/project-config/entities/project-configuration.entity';
import { Project } from '@app/modules/projects/entities/project.entity';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { GitHubAccount } from '../dto/github-account.dto';

export enum DeploymentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum DeplomentEnvironment {
  PRODUCTION = 'production',
  PREVIEW = 'preview',
}

@Entity('deployments')
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'project_id' })
  project_id: string;

  @ManyToOne(() => Project, project => project.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'license_id' })
  license_id: string;

  @ManyToOne(() => License, license => license.id, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  license: License;

  @Column({ name: 'user_license_id', nullable: true })
  user_license_id: string;

  @ManyToOne(() => UserLicense, { nullable: true })
  @JoinColumn({ name: 'user_license_id' })
  user_license: UserLicense | null;

  @Column({ name: 'configuration_id' })
  configuration_id: string;

  @ManyToOne(() => ProjectConfiguration, configuration => configuration.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'configuration_id' })
  configuration: ProjectConfiguration;

  @Column({
    type: 'enum',
    enum: DeplomentEnvironment,
  })
  environment: `${DeplomentEnvironment}`;

  @Column()
  branch: string;

  @Column({ name: 'workflow_run_id', nullable: true })
  workflow_run_id?: string;

  @Column({ name: 'site_id', nullable: true })
  site_id: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDING,
  })
  status: `${DeploymentStatus}`;

  @Column({ name: 'deployment_url', nullable: true })
  deployment_url?: string;

  @Column({ name: 'environment_variables', type: 'jsonb' })
  environment_variables: EnvironmentVariableDto[];

  @Column({ name: 'github_account', nullable: true, type: 'jsonb' })
  github_account?: GitHubAccount;

  @Column({ name: 'error_message', nullable: true })
  error_message?: string;

  @Column({ name: 'retry_count', default: 0 })
  retry_count: number;

  @Column({ name: 'is_test', default: false })
  is_test: boolean;

  @Column({ name: 'webhook_info', nullable: true, type: 'jsonb' })
  webhook_info?: {
    hookId: number;
    repositoryOwner: string;
    repositoryName: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'completed_at', nullable: true })
  completed_at: Date;
}
