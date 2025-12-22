import { User } from '@app/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  OTHER = 'other',
}

@Entity('media')
@Index(['filename'])
@Index(['tags'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  original_filename: string;

  @Column()
  mime_type: string;

  @Column({ type: 'enum', enum: MediaType, default: MediaType.OTHER })
  type: MediaType;

  @Column()
  size: number;

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnail_url: string;

  @Column({ nullable: true })
  width: number;

  @Column({ nullable: true })
  height: number;

  @Column({ nullable: false, default: 0 })
  duration: number;

  @Column({ nullable: true })
  alt: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, string>;

  @Column({ default: true })
  is_public: boolean;

  @Column({ nullable: true })
  @Index()
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
