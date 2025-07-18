import { LicenseOption } from '@app/modules/licenses/entities/license-option.entity';
import { UserLicense } from '@app/modules/licenses/entities/user-license.entity';
import { EnvironmentVariableDto } from '@app/modules/projects/dto/create-project-configuration.dto';
import { ProjectConfiguration } from '@app/modules/projects/entities/project-configuration.entity';
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

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, project => project.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'license_id' })
  licenseId: string;

  @ManyToOne(() => LicenseOption, license => license.id, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  license: LicenseOption;

  @Column({ name: 'user_license_id', nullable: true })
  userLicenseId: string;

  @ManyToOne(() => UserLicense)
  userLicense: UserLicense;

  @Column({ name: 'configuration_id' })
  configurationId: string;

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

  @Column({ nullable: true })
  workflowRunId?: string;

  @Column({ nullable: true })
  siteId: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDING,
  })
  status: `${DeploymentStatus}`;

  @Column({ nullable: true })
  deploymentUrl?: string;

  @Column({ name: 'environment_variables', type: 'jsonb' })
  environmentVariables: EnvironmentVariableDto[];

  @Column({ nullable: true, type: 'jsonb' })
  githubAccount?: GitHubAccount;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true, type: 'jsonb' })
  webhookInfo?: {
    hookId: number;
    repositoryOwner: string;
    repositoryName: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
