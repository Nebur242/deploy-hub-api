import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubscriptionPlanController } from './controllers/subscription-plan.controller';
import { UserSubscriptionController } from './controllers/user-subscription.controller';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { SubscriptionSeederService } from './services/subscription-seeder.service';
import { UserSubscriptionService } from './services/user-subscription.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPlan, UserSubscription])],
  controllers: [SubscriptionPlanController, UserSubscriptionController],
  providers: [SubscriptionPlanService, UserSubscriptionService, SubscriptionSeederService],
  exports: [SubscriptionPlanService, UserSubscriptionService, SubscriptionSeederService],
})
export class SubscriptionsModule {}
