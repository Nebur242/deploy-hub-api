import { Project } from '@app/modules/projects/entities/project.entity';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reviews')
@Index(['project_id', 'user_id'], { unique: true }) // One review per user per project
@Index(['project_id', 'rating'])
@Index(['created_at'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  project_id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'integer', default: 5 })
  rating: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ default: false })
  is_verified_purchase: boolean; // Only users who purchased the license can review

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Denormalized fields for performance
  @Column({ default: 0 })
  helpful_count: number; // Number of users who found this helpful

  @Column({ type: 'float', nullable: true })
  average_rating?: number; // Cached average rating for the project
}
