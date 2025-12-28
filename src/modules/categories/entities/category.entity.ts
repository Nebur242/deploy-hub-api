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

import { CategoryStatus } from '../dto/category.dto';

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

  @Column({ nullable: true })
  image?: string;

  @Column({ nullable: true })
  @Index()
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ nullable: true })
  parent_id?: string | null;

  @ManyToOne(() => Category, category => category.children, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: 'active' })
  status: `${CategoryStatus}`;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
