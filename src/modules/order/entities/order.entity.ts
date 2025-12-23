import { License } from '@app/modules/license/entities/license.entity';
import { Payment } from '@app/modules/payment/entities/payment.entity';
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

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  license_id: string;

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
  reference_number: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  completed_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'jsonb', nullable: false })
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    company?: string;
    address?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
  };

  @ManyToOne(() => License)
  @JoinColumn({ name: 'license_id' })
  license: License;

  @OneToMany(() => Payment, payment => payment.order)
  payments: Payment[];

  @Column({ nullable: true })
  notes: string;

  @Column({ default: false })
  is_active: boolean;

  @Column({ nullable: true })
  expires_at: Date;
}
