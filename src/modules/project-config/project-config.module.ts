import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectsModule } from '../projects/projects.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ProjectConfigurationController } from './controllers/project-configuration.controller';
import { ProjectVersionController } from './controllers/project-version.controller';
import { ProjectConfiguration } from './entities/project-configuration.entity';
import { ProjectVersion } from './entities/project-version.entity';
import { ProjectConfigurationService } from './services/project-configuration.service';
import { ProjectVersionService } from './services/project-version.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectVersion, ProjectConfiguration]),
    forwardRef(() => ProjectsModule),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [ProjectVersionController, ProjectConfigurationController],
  providers: [ProjectVersionService, ProjectConfigurationService, EncryptionService],
  exports: [ProjectVersionService, ProjectConfigurationService],
})
export class ProjectConfigModule {}
