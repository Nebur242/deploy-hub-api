import { Project } from '@app/modules/projects/entities/project.entity';
import { User } from '@app/modules/users/entities/user.entity';
import { Currency, LicensePeriod } from '@app/shared/enums';
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

@Entity('licenses')
export class License {
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
    description: 'Maximum number of deployments allowed (minimum 5)',
    example: 10,
    default: 5,
  })
  @Column({ name: 'deployment_limit', default: 5 })
  deployment_limit: number;

  @ApiProperty({
    description: 'License billing period (forever = one-time purchase, others = subscription)',
    enum: LicensePeriod,
    example: LicensePeriod.MONTHLY,
    default: LicensePeriod.FOREVER,
  })
  @Column({
    type: 'enum',
    enum: LicensePeriod,
    default: LicensePeriod.FOREVER,
  })
  period: LicensePeriod;

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
    description: 'Owner ID of the license',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  @Column({ name: 'owner_id', nullable: true })
  owner_id: string;

  @ApiProperty({
    description: 'Owner of the license',
    type: () => User,
  })
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({
    description: 'Status of the license',
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

  @ApiPropertyOptional({
    description: 'Stripe product ID for this license',
    example: 'prod_xxx',
  })
  @Column({ name: 'stripe_product_id', nullable: true })
  stripe_product_id: string;

  @ApiPropertyOptional({
    description: 'Stripe price ID for this license',
    example: 'price_xxx',
  })
  @Column({ name: 'stripe_price_id', nullable: true })
  stripe_price_id: string;
}
