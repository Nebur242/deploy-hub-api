import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('deployments')
export class DeploymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @Column()
  environment: 'production' | 'preview';

  @Column()
  branch: string;

  @Column({ nullable: true })
  githubAccount: string;

  @Column({ nullable: true })
  workflowRunId: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'running' | 'success' | 'failed';

  @Column({ nullable: true })
  deploymentUrl: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  vercelProjectId: string;

  @Column({ nullable: true })
  vercelOrgId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
