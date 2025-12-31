import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubscriptionService } from '../subscription/services/subscription.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { LicenseController } from './controllers/license.controller';
import { PublicLicenseController } from './controllers/public-license.controller';
import { UserLicenseController } from './controllers/user-license.controller';
import { License } from './entities/license.entity';
import { UserLicense } from './entities/user-license.entity';
import { LicenseService } from './services/license.service';
import { UserLicenseService } from './services/user-license.service';

@Module({
  imports: [
    ProjectsModule,
    TypeOrmModule.forFeature([License, UserLicense]),
    forwardRef(() => PaymentModule),
    forwardRef(() => OrderModule),
    forwardRef(() => SubscriptionModule),
  ],
  providers: [LicenseService, UserLicenseService],
  controllers: [LicenseController, UserLicenseController, PublicLicenseController],
  exports: [LicenseService, UserLicenseService],
})
export class LicenseModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private licenseService: LicenseService,
  ) {}

  onModuleInit() {
    // Wire up the license service to subscription service to avoid circular dependency
    const subscriptionService = this.moduleRef.get(SubscriptionService, { strict: false });
    if (subscriptionService) {
      subscriptionService.setLicenseService(this.licenseService);
    }
  }
}
