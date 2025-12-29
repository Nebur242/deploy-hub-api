import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { Deployment } from './entities/deployment.entity';
import { DeploymentEventListener } from './listeners/deployment-event.listener';
import { DeploymentRepository } from './repositories/deployment.repository';
import { DeploymentConcurrencyService } from './services/deployment-concurrency.service';
import { DeploymentOrchestratorService } from './services/deployment-orchestrator.service';
import { DeploymentTrackerService } from './services/deployment-tracker.service';
import { GitHubAccountManagerService } from './services/github-account-manager.service';
import { GithubDeployerService } from './services/github-deployer.service';
import { GithubWebhookService } from './services/github-webhook.service';
import { NetlifyService } from './services/netlify.service';
import { DeploymentUrlExtractorService } from './services/url-extractor.service';
import { VercelService } from './services/vercel.service';
import { GithubWebhookController } from './webhook.controller';
import { LicenseModule } from '../license/license.module';
import { ProjectConfigModule } from '../project-config/project-config.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deployment]),
    forwardRef(() => LicenseModule),
    forwardRef(() => ProjectConfigModule),
    forwardRef(() => ProjectsModule),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [DeploymentController, GithubWebhookController],
  providers: [
    DeploymentService,
    DeploymentRepository,
    GitHubAccountManagerService,
    DeploymentConcurrencyService,
    DeploymentOrchestratorService,
    GithubDeployerService,
    EncryptionService,
    VercelService,
    NetlifyService,
    DeploymentTrackerService,
    GithubWebhookService,
    DeploymentUrlExtractorService,
    DeploymentEventListener,
  ],
  exports: [
    DeploymentService,
    DeploymentRepository,
    GithubDeployerService,
    GitHubAccountManagerService,
    DeploymentConcurrencyService,
  ],
})
export class DeploymentModule {}
