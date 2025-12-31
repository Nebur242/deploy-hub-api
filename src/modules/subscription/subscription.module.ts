import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlansController, SubscriptionController, WebhookController } from './controllers';
import { LicenseModule } from '../license/license.module';
import { ProjectsModule } from '../projects/projects.module';
import { UserModule } from '../users/users.module';
import { Subscription } from './entities/subscription.entity';
import { StripeService, SubscriptionService } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription]),
    ConfigModule,
    UserModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => LicenseModule),
  ],
  controllers: [PlansController, SubscriptionController, WebhookController],
  providers: [StripeService, SubscriptionService],
  exports: [SubscriptionService, StripeService],
})
export class SubscriptionModule {}
