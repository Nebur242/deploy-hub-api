import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { NotificationType } from '../enums/notification-type.enum';

class TokenInfoDto {
  token: string;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    version?: string;
    deviceName?: string;
  };
}

export class UpdateTokenDto {
  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Type of notification these tokens are for',
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({
    type: [TokenInfoDto],
    description: 'Tokens to add',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenInfoDto)
  addTokens?: TokenInfoDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Tokens to remove',
  })
  @IsOptional()
  @IsArray()
  removeTokens?: string[];
}
