import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicensesModule } from '../licenses/licenses.module';
import { UserModule } from '../users/users.module';
import { OrderController } from './controllers/order.controller';
import { PaymentController } from './controllers/payment.controller';
import { Order } from './entities/order.entity';
import { Payment } from './entities/payment.entity';
import { OrderService } from './services/order.service';
import { PaymentService } from './services/payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment]),
    forwardRef(() => LicensesModule), // Using forwardRef to break circular dependency
    UserModule,
  ],
  controllers: [PaymentController, OrderController],
  providers: [PaymentService, OrderService],
  exports: [PaymentService, OrderService],
})
export class PaymentModule {}
