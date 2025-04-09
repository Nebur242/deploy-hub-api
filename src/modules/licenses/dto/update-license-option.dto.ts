import { PartialType } from '@nestjs/mapped-types';

import { CreateLicenseOptionDto } from './create-license-option.dto';

export class UpdateLicenseOptionDto extends PartialType(CreateLicenseOptionDto) {}
