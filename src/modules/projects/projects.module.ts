import { EncryptionService } from '@app/common/encryption/encryption.service';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectConfigurationController } from './controllers/project-configuration.controller';
import { ProjectVersionController } from './controllers/project-version.controller';
import { ProjectController } from './controllers/project.controller';
import { PublicProjectController } from './controllers/public-project.controller';
import { ProjectConfiguration } from './entities/project-configuration.entity';
import { ProjectVersion } from './entities/project-version.entity';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectConfigurationService } from './services/project-configuration.service';
import { ProjectVersionService } from './services/project-version.service';
import { ProjectService } from './services/project.service';
import { PublicProjectService } from './services/public-project.service';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectVersion, ProjectConfiguration, Category])],
  providers: [
    ProjectRepository,
    ProjectService,
    ProjectVersionService,
    ProjectConfigurationService,
    PublicProjectService,
    EncryptionService,
  ],
  controllers: [
    ProjectController,
    ProjectVersionController,
    ProjectConfigurationController,
    PublicProjectController,
  ],
  exports: [
    ProjectRepository,
    ProjectService,
    ProjectVersionService,
    ProjectConfigurationService,
    PublicProjectService,
  ],
})
export class ProjectsModule implements OnModuleInit {
  constructor(private readonly encryptionService: EncryptionService) {}

  onModuleInit() {
    // Inject the encryption service into the ProjectConfiguration entity
    // This will make it available for the BeforeInsert and BeforeUpdate hooks
    ProjectConfiguration.setEncryptionService(this.encryptionService);
  }
}
