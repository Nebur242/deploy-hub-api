import { PartialType, OmitType } from '@nestjs/swagger';

import { CreateMediaDto } from './create-media.dto';

export class UpdateMediaDto extends PartialType(
  OmitType(CreateMediaDto, ['url', 'original_filename', 'mime_type', 'size']),
) {}
