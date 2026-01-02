import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserLicense } from '../license/entities/user-license.entity';
import { LicenseModule } from '../license/license.module';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../users/users.module';
import { PaymentController } from './controllers/payment.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './services/payment.service';
import { StripeService } from './services/stripe.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, UserLicense]),
    forwardRef(() => LicenseModule),
    forwardRef(() => OrderModule),
    UserModule,
  ],
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService, StripeService],
  exports: [PaymentService, StripeService],
})
export class PaymentModule {}
