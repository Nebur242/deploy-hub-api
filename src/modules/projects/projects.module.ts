import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from '../categories/entities/category.entity';
import { ProjectConfigModule } from '../project-config/project-config.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminProjectController } from './controllers/admin-project.controller';
import { ProjectController } from './controllers/project.controller';
import { PublicProjectController } from './controllers/public-project.controller';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectService } from './services/project.service';
import { PublicProjectService } from './services/public-project.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Category]),
    forwardRef(() => ProjectConfigModule),
    forwardRef(() => SubscriptionModule),
  ],
  providers: [ProjectRepository, ProjectService, PublicProjectService],
  controllers: [ProjectController, PublicProjectController, AdminProjectController],
  exports: [ProjectRepository, ProjectService, PublicProjectService, TypeOrmModule],
})
export class ProjectsModule {}
