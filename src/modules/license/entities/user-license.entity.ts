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

export enum UserLicenseStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  PAUSED = 'paused',
}

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

  @Column({
    type: 'enum',
    enum: UserLicenseStatus,
    default: UserLicenseStatus.ACTIVE,
  })
  status: UserLicenseStatus;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'max_deployments' })
  max_deployments: number;

  @Column({ type: 'text', array: true, default: [] })
  deployments: string[];

  @Column({ type: 'boolean', default: false })
  trial: boolean;

  // Stripe subscription fields
  @Column({ name: 'stripe_subscription_id', nullable: true })
  stripe_subscription_id?: string;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripe_customer_id?: string;

  @Column({ name: 'current_period_start', type: 'timestamp', nullable: true })
  current_period_start?: Date;

  @Column({ name: 'current_period_end', type: 'timestamp', nullable: true })
  current_period_end?: Date;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancel_at_period_end: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
