import { Project } from '@app/modules/projects/entities/project.entity';
import { User } from '@app/modules/users/entities/user.entity';
import { Currency } from '@app/shared/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum LicenseStatus {
  DRAFT = 'draft',
  PUBLIC = 'public',
  PRIVATE = 'private',
  ARCHIVED = 'archived',
}

@Entity('license_options')
export class LicenseOption {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'License name', example: 'Enterprise License' })
  @Column()
  name: string;

  @ApiProperty({ description: 'License description', example: 'Full access to all features' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'License price', example: 99.99 })
  @Column()
  price: number;

  @ApiProperty({
    description: 'Currency type',
    enum: Currency,
    default: Currency.USD,
    example: Currency.USD,
  })
  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Maximum number of deployments allowed',
    example: 5,
    default: 1,
  })
  @Column({ name: 'deployment_limit', default: 1 })
  deploymentLimit: number;

  @ApiProperty({
    description: 'License duration in days (0 means unlimited)',
    example: 365,
    default: 0,
  })
  @Column({ default: 0 }) // 0 means unlimited
  duration: number;

  @ApiProperty({
    description: 'List of features included in this license',
    example: ['CI/CD Integration', 'Premium Support', 'Custom Domain'],
    default: [],
  })
  @Column({ type: 'text', array: true, default: [] })
  features: string[];

  @ApiPropertyOptional({
    description: 'Projects associated with this license',
    type: () => Project,
    isArray: true,
  })
  @ManyToMany(() => Project, project => project.licenses)
  projects: Project[];

  @ApiProperty({
    description: 'Owner ID of the license option',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  @Column({ name: 'owner_id', nullable: true })
  ownerId: string;

  @ApiProperty({
    description: 'Owner of the license option',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    description: 'Status of the license option',
    enum: LicenseStatus,
    example: LicenseStatus.DRAFT,
  })
  @Column({
    type: 'enum',
    enum: LicenseStatus,
    default: LicenseStatus.DRAFT,
  })
  status: LicenseStatus;

  @ApiProperty({
    description: 'Indicates if the license is popular',
    example: false,
    default: false,
  })
  @Column({ default: false })
  popular: boolean;
}
