import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicenseModule } from '../license/license.module';
import { CouponController } from './controllers/coupon.controller';
import { OrderController } from './controllers/order.controller';
import { Coupon } from './entities/coupon.entity';
import { Order } from './entities/order.entity';
import { CouponRepository } from './repositories/coupon.repository';
import { CouponService } from './services/coupon.service';
import { OrderService } from './services/order.service';
import { License } from '../license/entities/license.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Coupon, License]), forwardRef(() => LicenseModule)],
  controllers: [OrderController, CouponController],
  providers: [OrderService, CouponService, CouponRepository],
  exports: [OrderService, CouponService, CouponRepository, TypeOrmModule],
})
export class OrderModule {}
