import { User } from '@app/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('deployments_count')
export class DeploymentCount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'license_id' })
  licenseId: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'max_deployments' })
  maxDeployments: number;

  @Column({ type: 'text', array: true, default: [] })
  deployments: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
