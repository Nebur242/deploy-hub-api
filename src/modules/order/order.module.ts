import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicenseModule } from '../license/license.module';
import { OrderController } from './controllers/order.controller';
import { Order } from './entities/order.entity';
import { OrderService } from './services/order.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), forwardRef(() => LicenseModule)],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService, TypeOrmModule],
})
export class OrderModule {}
