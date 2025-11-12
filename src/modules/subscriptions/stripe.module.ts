import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { StripeService } from './services/stripe.service';
import { SubscriptionSeederService } from './services/subscription-seeder.service';
import { UserSubscriptionService } from './services/user-subscription.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([UserSubscription, SubscriptionPlan])],
  providers: [StripeService, UserSubscriptionService, SubscriptionSeederService],
  controllers: [StripeWebhookController],
  exports: [StripeService],
})
export class StripeModule {}
