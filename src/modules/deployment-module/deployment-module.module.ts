import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { Deployment } from './entities/deployment.entity';
import { GithubDeployerService } from './services/github-deployer.service';
import { ProjectConfiguration } from '../projects/entities/project-configuration.entity';
import { Project } from '../projects/entities/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deployment, Project, ProjectConfiguration])],
  controllers: [DeploymentController],
  providers: [DeploymentService, GithubDeployerService, EncryptionService],
  exports: [DeploymentService, GithubDeployerService],
})
export class DeploymentModule {}
