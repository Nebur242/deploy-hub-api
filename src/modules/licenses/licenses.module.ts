import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module';
import { LicenseOptionService } from './services/license-option.service';

@Module({
  imports: [ProjectsModule],
  providers: [LicenseOptionService],
})
export class LicensesModule {}
