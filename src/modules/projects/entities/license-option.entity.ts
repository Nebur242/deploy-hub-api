import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from './project.entity';

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
}

@Entity('license_options')
export class LicenseOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @Column({ name: 'deployment_limit', default: 1 })
  deploymentLimit: number;

  @Column({ default: 0 }) // 0 means unlimited
  duration: number;

  @Column({ type: 'text', array: true, default: [] })
  features: string[];

  @ManyToMany(() => Project, project => project.licenses)
  projects: Project[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
