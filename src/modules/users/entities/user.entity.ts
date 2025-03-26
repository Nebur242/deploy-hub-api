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

import { UserPreferences } from './user-preferences.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  uid: string;

  @Column({ length: 50, nullable: true })
  firstName?: string;

  @Column({ length: 50, nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  profilePicture: string;

  @OneToOne(() => UserPreferences, { cascade: true })
  @JoinColumn()
  preferences: UserPreferences;

  @Column({ nullable: false, type: 'enum', enum: Role, default: ['user'], array: true })
  roles: `${Role}`[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
