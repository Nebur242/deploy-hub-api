import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';

import { License } from '../../license/entities/license.entity';
import { User } from '../../users/entities/user.entity';

@Entity('coupons')
@Index('idx_coupon_owner', ['owner_id'])
@Index('idx_coupon_code_active', ['code', 'is_active'])
@Index('idx_coupon_expires', ['expires_at'])
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  owner_id: string;

  @Column({
    type: 'varchar',
    unique: true,
  })
  code: string; // Coupon code - stored uppercase, validated case-insensitive

  @Column({
    type: 'varchar',
    enum: ['percent', 'fixed'],
  })
  discount_type: 'percent' | 'fixed';

  @Column('decimal', { precision: 10, scale: 2 })
  discount_value: number; // Percentage (0-100) or fixed amount

  /**
   * Applicable licenses for this coupon
   * If empty array, coupon applies to all licenses
   */
  @ManyToMany(() => License, { cascade: false })
  @JoinTable({
    name: 'coupon_licenses',
    joinColumn: { name: 'coupon_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'license_id', referencedColumnName: 'id' },
  })
  licenses: License[];

  @Column('integer', { nullable: true, default: null })
  max_uses: number | null; // null = unlimited uses

  @Column('integer', { default: 0 })
  current_uses: number;

  @Column('timestamp', { nullable: true, default: null })
  expires_at: Date | null; // null = never expires

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('text', { nullable: true })
  description: string | null; // e.g., "Summer Sale 2024"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { eager: false })
  owner: User;

  /**
   * Check if coupon can still be used
   */
  isValid(): boolean {
    // Check if active
    if (!this.is_active) {
      return false;
    }

    // Check expiration
    if (this.expires_at && new Date() > this.expires_at) {
      return false;
    }

    // Check max uses
    if (this.max_uses !== null && this.current_uses >= this.max_uses) {
      return false;
    }

    return true;
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(baseAmount: number): number {
    if (this.discount_type === 'percent') {
      return (baseAmount * this.discount_value) / 100;
    }
    return this.discount_value;
  }
}
