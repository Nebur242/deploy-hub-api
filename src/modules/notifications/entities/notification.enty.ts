import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { Notification } from '../interfaces/notification.interface';

export enum NotificationScope {
  DEPLOYMENT = 'DEPLOYMENT',
  PAYMENT = 'PAYMENT',
  ORDER = 'ORDER',
  SALE = 'SALE',
  PROJECTS = 'PROJECTS',
  LICENCES = 'LICENSES',
  WELCOME = 'WELCOME',
  ACCOUNT = 'ACCOUNT',
}

export const NotificationHbsTemplate = {
  [NotificationScope.DEPLOYMENT]: 'deployment-notification',
  [NotificationScope.PAYMENT]: 'payment-notification',
  [NotificationScope.ORDER]: 'order-notification',
  [NotificationScope.SALE]: 'sale-notification',
  [NotificationScope.PROJECTS]: 'project-notification',
  [NotificationScope.LICENCES]: 'license-notification',
  [NotificationScope.WELCOME]: 'welcome',
  [NotificationScope.ACCOUNT]: 'account-notification',
};

@Entity('notifications')
export class NotificationEntity implements Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationScope,
    nullable: true,
  })
  scope: NotificationScope;

  @Column({ nullable: false })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  recipient?: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text', nullable: false })
  message: string;

  @Column({ nullable: true })
  template?: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  error?: string;

  @Column({ default: false })
  read: boolean;

  @Column({ nullable: true })
  readAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
