import { Media } from '@app/modules/media/entities/media.entity';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  @Index()
  name: string;

  @Column({ length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ length: 50, default: 'default-category-icon' })
  icon: string;

  @ManyToOne(() => Media, { nullable: true })
  @JoinColumn({ name: 'mediaId' })
  media?: Media;

  @Column({
    nullable: true,
    type: 'uuid',
  })
  mediaId?: string;

  @Column({ nullable: true })
  @Index()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ nullable: true })
  parentId?: string;

  @ManyToOne(() => Category, category => category.children, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent?: Category;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: 'active' })
  status: 'pending' | 'active' | 'inactive' | 'deleted';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
