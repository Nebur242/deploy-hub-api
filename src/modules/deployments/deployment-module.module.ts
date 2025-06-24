import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { Deployment } from './entities/deployment.entity';
import { DeploymentTrackerService } from './services/deployment-tracker.service';
import { GithubDeployerService } from './services/github-deployer.service';
import { GithubWebhookService } from './services/github-webhook.service';
import { NetlifyService } from './services/netlify.service';
import { DeploymentUrlExtractorService } from './services/url-extractor.service';
import { VercelService } from './services/vercel.service';
import { GithubWebhookController } from './webhook.controller';
import { LicenseOption } from '../licenses/entities/license-option.entity';
import { UserLicense } from '../licenses/entities/user-license.entity';
import { ProjectConfiguration } from '../projects/entities/project-configuration.entity';
import { Project } from '../projects/entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Deployment,
      Project,
      ProjectConfiguration,
      LicenseOption,
      UserLicense,
    ]),
  ],
  controllers: [DeploymentController, GithubWebhookController],
  providers: [
    DeploymentService,
    GithubDeployerService,
    EncryptionService,
    VercelService,
    NetlifyService,
    DeploymentTrackerService,
    GithubWebhookService,
    DeploymentUrlExtractorService,
  ],
  exports: [DeploymentService, GithubDeployerService],
})
export class DeploymentModule {}
