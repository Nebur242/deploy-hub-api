import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicenseOptionController } from './controllers/license-option.controller';
import { ProjectConfigurationController } from './controllers/project-configuration.controller';
import { ProjectVersionController } from './controllers/project-version.controller';
import { ProjectController } from './controllers/project.controller';
import { PublicLicenseOptionController } from './controllers/public-license-option.controller';
import { PublicProjectController } from './controllers/public-project.controller';
import { LicenseOption } from './entities/license-option.entity';
import { ProjectConfiguration } from './entities/project-configuration.entity';
import { ProjectVersion } from './entities/project-version.entity';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './repositories/project.repository';
import { LicenseOptionService } from './services/license-option.service';
import { ProjectConfigurationService } from './services/project-configuration.service';
import { ProjectVersionService } from './services/project-version.service';
import { ProjectService } from './services/project.service';
import { PublicProjectService } from './services/public-project.service';
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
    PublicProjectService,
  ],
  controllers: [
    ProjectController,
    ProjectVersionController,
    ProjectConfigurationController,
    LicenseOptionController,
    PublicProjectController,
    PublicLicenseOptionController,
  ],
  exports: [
    ProjectRepository,
    ProjectService,
    ProjectVersionService,
    ProjectConfigurationService,
    LicenseOptionService,
    PublicProjectService,
  ],
})
export class ProjectsModule {}
