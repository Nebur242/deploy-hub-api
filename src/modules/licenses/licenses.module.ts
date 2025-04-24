import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../payment/entities/order.entity';
import { PaymentModule } from '../payment/payment.module';
import { ProjectsModule } from '../projects/projects.module';
import { LicenseOptionController } from './controllers/license-option.controller';
import { UserLicenseController } from './controllers/user-license.controller';
import { LicenseOption } from './entities/license-option.entity';
import { LicenseOptionService } from './services/license-option.service';
import { UserLicenseService } from './services/user-license.service';

@Module({
  imports: [
    ProjectsModule,
    TypeOrmModule.forFeature([LicenseOption, Order]),
    forwardRef(() => PaymentModule), // Using forwardRef to break circular dependency
  ],
  providers: [LicenseOptionService, UserLicenseService],
  controllers: [LicenseOptionController, UserLicenseController],
  exports: [LicenseOptionService, UserLicenseService],
})
export class LicensesModule {}
