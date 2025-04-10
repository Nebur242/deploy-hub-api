import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectsModule } from '../projects/projects.module';
import { LicenseOptionController } from './controllers/license-option.controller';
import { LicenseOption } from './entities/license-option.entity';
import { LicenseOptionService } from './services/license-option.service';

@Module({
  imports: [ProjectsModule, TypeOrmModule.forFeature([LicenseOption])],
  providers: [LicenseOptionService],
  controllers: [LicenseOptionController],
})
export class LicensesModule {}
