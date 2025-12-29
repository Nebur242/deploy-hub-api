import { Deployment } from '@app/modules/deployments/entities/deployment.entity';
import { DeploymentRepository } from '@app/modules/deployments/repositories/deployment.repository';
import { License } from '@app/modules/license/entities/license.entity';
import { UserLicense } from '@app/modules/license/entities/user-license.entity';
import { Project } from '@app/modules/projects/entities/project.entity';
import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Deployment, License, UserLicense, Project])],
  controllers: [StatisticsController],
  providers: [StatisticsService, DeploymentRepository, ProjectRepository],
  exports: [StatisticsService],
})
export class StatisticsModule {}
