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
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'license_id' })
  license_id: string;

  @ManyToOne(() => License, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'license_id' })
  license: License;

  @Column({ type: 'date', nullable: true })
  expires_at?: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'max_deployments' })
  max_deployments: number;

  @Column({ type: 'text', array: true, default: [] })
  deployments: string[];

  @Column({ type: 'boolean', default: false })
  trial: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
