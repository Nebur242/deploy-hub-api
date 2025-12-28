import { Role } from '@app/shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserNotification } from './user-notification.entity';
import { UserPreferences } from './user-preferences.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  uid: string;

  @Column({ nullable: false, unique: true })
  email: string;

  @Column({ length: 50, nullable: true })
  first_name?: string;

  @Column({ length: 50, nullable: true })
  last_name?: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  profile_picture: string;

  @OneToOne(() => UserPreferences, { cascade: true })
  @JoinColumn()
  preferences: UserPreferences;

  @OneToOne(() => UserNotification, { cascade: true })
  @JoinColumn()
  notifications: UserNotification;

  @Column({ nullable: false, type: 'enum', enum: Role, default: ['user'], array: true })
  roles: `${Role}`[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
