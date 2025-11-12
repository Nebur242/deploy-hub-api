import { Currency } from '@app/shared/enums';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { UserSubscription } from './user-subscription.entity';

export enum SubscriptionPlanType {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export enum SubscriptionPlanStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

export enum SubscriptionFeature {
  UNLIMITED_PROJECTS = 'unlimited_projects',
  UNLIMITED_DEPLOYMENTS = 'unlimited_deployments',
  CUSTOM_DOMAINS = 'custom_domains',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  PRIORITY_SUPPORT = 'priority_support',
  API_ACCESS = 'api_access',
  TEAM_COLLABORATION = 'team_collaboration',
  WHITE_LABEL = 'white_label',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: SubscriptionPlanType,
  })
  type: SubscriptionPlanType;

  @Column({
    type: 'enum',
    enum: SubscriptionPlanStatus,
    default: SubscriptionPlanStatus.ACTIVE,
  })
  status: SubscriptionPlanStatus;

  @Column({ default: 0, name: 'max_projects' })
  maxProjects: number; // 0 means unlimited

  @Column({ default: 0, name: 'max_deployments' })
  maxDeployments: number; // 0 means unlimited

  @Column({ default: 0, name: 'max_team_members' })
  maxTeamMembers: number; // 0 means unlimited

  @Column({ type: 'jsonb', default: [] })
  features: SubscriptionFeature[];

  @Column({ default: false })
  popular: boolean;

  @Column({ type: 'text', nullable: true, name: 'stripe_product_id' })
  stripeProductId?: string;

  @Column({ type: 'text', nullable: true, name: 'stripe_price_id' })
  stripePriceId?: string;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => UserSubscription, userSubscription => userSubscription.plan)
  userSubscriptions: UserSubscription[];

  @Column({ default: false })
  isFreeTier: boolean; // Indicates if this is a free tier plan

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
