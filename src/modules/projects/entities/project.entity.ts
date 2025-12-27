import { Category } from '@app/modules/categories/entities/category.entity';
import { License } from '@app/modules/license/entities/license.entity';
import { ProjectConfiguration } from '@app/modules/project-config/entities/project-configuration.entity';
import { ProjectVersion } from '@app/modules/project-config/entities/project-version.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TechStack {
  REACT = 'react',
  NEXTJS = 'nextjs',
}

export enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FEATURED = 'featured',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'owner_id' })
  owner_id: string;

  @Column({ nullable: false })
  repository: string;

  @Column({ nullable: true })
  preview_url?: string;

  @Column({ nullable: true })
  image?: string;

  @Column({ length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', array: true, default: [] })
  tech_stack: string[];

  @Column({
    type: 'enum',
    enum: Visibility,
    default: Visibility.PRIVATE,
  })
  visibility: Visibility;

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'project_categories',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProjectVersion, version => version.project, {
    cascade: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  versions: ProjectVersion[];

  @OneToMany(() => ProjectConfiguration, config => config.project, {
    cascade: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  configurations: ProjectConfiguration[];

  @ManyToMany(() => License, license => license.projects)
  @JoinTable({
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'license_id', referencedColumnName: 'id' },
  })
  licenses: License[];
}
