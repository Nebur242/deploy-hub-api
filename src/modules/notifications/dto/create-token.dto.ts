import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

import { NotificationType } from '../enums/notification-type.enum';

export class CreateTokenDto {
  @ApiProperty({ description: 'The notification token string' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    description: 'Optional device information',
    example: {
      platform: 'iOS',
      browser: 'Safari',
      version: '15.0',
      deviceName: 'iPhone 13 Pro',
    },
  })
  @IsObject()
  @IsOptional()
  deviceInfo?: {
    platform?: string;
    browser?: string;
    version?: string;
    deviceName?: string;
  };

  @ApiPropertyOptional({
    enum: NotificationType,
    default: NotificationType.SYSTEM,
    description: 'Type of notification this token is for',
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;
}
