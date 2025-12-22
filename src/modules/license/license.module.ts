import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../payment/entities/order.entity';
import { PaymentModule } from '../payment/payment.module';
import { ProjectsModule } from '../projects/projects.module';
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
    TypeOrmModule.forFeature([License, Order, UserLicense]),
    forwardRef(() => PaymentModule), // Using forwardRef to break circular dependency
  ],
  providers: [LicenseService, UserLicenseService],
  controllers: [LicenseController, UserLicenseController, PublicLicenseController],
  exports: [LicenseService, UserLicenseService],
})
export class LicenseModule {}
