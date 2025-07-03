import { LicenseOption } from '@app/modules/licenses/entities/license-option.entity';
import { User } from '@app/modules/users/entities/user.entity';
import { Currency, OrderStatus } from '@app/shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Payment } from './payment.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  licenseId: string;

  @Column()
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ nullable: true })
  referenceNumber: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'jsonb', nullable: true })
  billing: {
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    address?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };

  @ManyToOne(() => LicenseOption)
  @JoinColumn({ name: 'licenseId' })
  license: LicenseOption;

  @OneToMany(() => Payment, payment => payment.order)
  payments: Payment[];

  @Column({ nullable: true })
  notes: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true })
  expiresAt: Date;
}
