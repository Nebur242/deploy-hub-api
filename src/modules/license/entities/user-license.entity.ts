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

import { License } from './license.entity';

@Entity('user_licenses')
export class UserLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('owner_id')
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ name: 'license_id' })
  licenseId: string;

  @ManyToOne(() => License, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'license_id' })
  license: License;

  @Column({ type: 'date', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'max_deployments' })
  maxDeployments: number;

  @Column({ type: 'text', array: true, default: [] })
  deployments: string[];

  @Column({ type: 'boolean', default: false })
  trial: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
