import { Category } from '@app/modules/categories/entities/category.entity';
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

import { LicenseOption } from './license-option.entity';
import { ProjectConfiguration } from './project-configuration.entity';
import { ProjectVersion } from './project-version.entity';

export enum TechStack {
  REACT = 'react',
  NEXTJS = 'nextjs',
  //   VUE = 'vue',
  //   ANGULAR = 'angular',
  //   NODE = 'node',
  //   NESTJS = 'nestjs',
  //   DJANGO = 'django',
  //   FLASK = 'flask',
  //   LARAVEL = 'laravel',
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
  ownerId: string;

  @Column({ nullable: true })
  repository: string;

  @Column({ length: 100, unique: true })
  @Index()
  slug: string;

  @Column({
    type: 'enum',
    enum: TechStack,
    array: true,
    default: [],
  })
  techStack: TechStack[];

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
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

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

  @ManyToMany(() => LicenseOption, licenseOption => licenseOption.projects)
  @JoinTable({
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'license_id', referencedColumnName: 'id' },
  })
  licenses: LicenseOption[];
}
