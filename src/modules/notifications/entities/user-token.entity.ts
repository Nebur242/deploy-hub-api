import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { NotificationType } from '../enums/notification-type.enum';

@Entity('user_tokens')
export class UserTokenEntity {
  @PrimaryColumn()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    nullable: false,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column('text', { array: true, default: [] })
  tokens: string[];

  @Column('jsonb', { nullable: true })
  deviceInfo?: Array<{
    token: string;
    platform?: string;
    browser?: string;
    version?: string;
    deviceName?: string;
    addedAt?: Date;
    lastActive?: Date;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
