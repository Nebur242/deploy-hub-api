import { PartialType } from '@nestjs/mapped-types';

import { CreateProjectConfigurationDto } from './create-project-configuration.dto';

export class UpdateProjectConfigurationDto extends PartialType(CreateProjectConfigurationDto) {}
