import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReviewController } from './controllers/review.controller';
import { Review } from './entities/review.entity';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewService } from './services/review.service';
import { LicenseModule } from '../license/license.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    forwardRef(() => ProjectsModule),
    forwardRef(() => LicenseModule),
  ],
  providers: [ReviewRepository, ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService, ReviewRepository],
})
export class ReviewsModule {}
