import { DeploymentModule } from '@app/modules/deployments/deployment.module';
import { LicenseModule } from '@app/modules/license/license.module';
import { OrderModule } from '@app/modules/order/order.module';
import { ProjectsModule } from '@app/modules/projects/projects.module';
import { forwardRef, Module } from '@nestjs/common';

import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [
    forwardRef(() => DeploymentModule),
    forwardRef(() => LicenseModule),
    forwardRef(() => ProjectsModule),
    forwardRef(() => OrderModule),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
