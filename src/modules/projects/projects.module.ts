import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicenseOptionController } from './controllers/license-option.controller';
import { ProjectConfigurationController } from './controllers/project-configuration.controller';
import { ProjectVersionController } from './controllers/project-version.controller';
import { LicenseOption } from './entities/license-option.entity';
import { ProjectConfiguration } from './entities/project-configuration.entity';
import { ProjectVersion } from './entities/project-version.entity';
import { Project } from './entities/project.entity';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './repositories/project.repository';
import { LicenseOptionService } from './services/license-option.service';
import { ProjectConfigurationService } from './services/project-configuration.service';
import { ProjectVersionService } from './services/project-version.service';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectVersion,
      ProjectConfiguration,
      LicenseOption,
      Category,
    ]),
  ],
  providers: [
    ProjectRepository,
    ProjectService,
    ProjectVersionService,
    ProjectConfigurationService,
    LicenseOptionService,
  ],
  controllers: [
    ProjectController,
    ProjectVersionController,
    ProjectConfigurationController,
    LicenseOptionController,
  ],
  exports: [
    ProjectRepository,
    ProjectService,
    ProjectVersionService,
    ProjectConfigurationService,
    LicenseOptionService,
  ],
})
export class ProjectsModule {}
