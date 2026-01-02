import { User } from '@app/modules/users/entities/user.entity';
import { BillingInterval, Currency, SubscriptionPlan, SubscriptionStatus } from '@app/shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ nullable: true })
  stripe_customer_id?: string;

  @Column({ nullable: true })
  stripe_subscription_id?: string;

  @Column({ nullable: true })
  stripe_price_id?: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    nullable: true,
  })
  billing_interval?: BillingInterval;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ nullable: true })
  current_period_start?: Date;

  @Column({ nullable: true })
  current_period_end?: Date;

  @Column({ nullable: true })
  cancel_at?: Date;

  @Column({ default: false })
  cancel_at_period_end: boolean;

  @Column({ nullable: true })
  canceled_at?: Date;

  @Column({ nullable: true })
  trial_start?: Date;

  @Column({ nullable: true })
  trial_end?: Date;

  // Plan limits
  @Column({ default: 1 })
  max_projects: number;

  @Column({ default: 50 })
  max_deployments: number; // Total deployment credits

  @Column({ default: 0 })
  total_deployments_used: number; // Total deployments used (lifetime)

  @Column({ default: 10 })
  max_deployments_per_month: number; // Monthly rate limit

  @Column({ default: 0 })
  deployments_this_month: number;

  @Column({ nullable: true })
  deployment_count_reset_at?: Date;

  @Column({ default: 2 })
  max_github_accounts: number; // Max GitHub accounts (each ~2000 actions/month)

  @Column({ default: false })
  custom_domain_enabled: boolean;

  @Column({ default: false })
  priority_support: boolean;

  @Column({ default: false })
  analytics_enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
