import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '../categories/categories.module';
import { Category } from '../categories/entities/category.entity';
import { ProjectConfigModule } from '../project-config/project-config.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserModule } from '../users/users.module';
import { AdminProjectController } from './controllers/admin-project.controller';
import { ProjectController } from './controllers/project.controller';
import { PublicProjectController } from './controllers/public-project.controller';
import { ModerationHistory } from './entities/moderation-history.entity';
import { Project } from './entities/project.entity';
import { ModerationEventListener } from './listeners/moderation-event.listener';
import { ModerationHistoryRepository } from './repositories/moderation-history.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ModerationHistoryService } from './services/moderation-history.service';
import { ProjectService } from './services/project.service';
import { PublicProjectService } from './services/public-project.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Category, ModerationHistory]),
    forwardRef(() => ProjectConfigModule),
    forwardRef(() => SubscriptionModule),
    CategoriesModule,
    UserModule,
  ],
  providers: [
    ProjectRepository,
    ModerationHistoryRepository,
    ProjectService,
    PublicProjectService,
    ModerationHistoryService,
    ModerationEventListener,
  ],
  controllers: [ProjectController, PublicProjectController, AdminProjectController],
  exports: [
    ProjectRepository,
    ModerationHistoryRepository,
    ProjectService,
    PublicProjectService,
    ModerationHistoryService,
    TypeOrmModule,
  ],
})
export class ProjectsModule {}
