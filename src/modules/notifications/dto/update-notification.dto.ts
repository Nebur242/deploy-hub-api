import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    description: 'The type of notification',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'The scope of the notification',
    enum: NotificationScope,
  })
  @IsEnum(NotificationScope)
  @IsOptional()
  scope?: NotificationScope;

  @ApiPropertyOptional({
    description: 'The recipient of the notification (e.g., email address)',
    example: 'user@example.com',
  })
  @IsString()
  @IsOptional()
  recipient?: string;

  @ApiPropertyOptional({
    description: 'The subject of the notification',
    example: 'Updated: Deployment Complete',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    description: 'The notification message',
    example: 'Your deployment has been updated successfully.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'The template identifier to use',
    example: 'updated-deployment',
  })
  @IsString()
  @IsOptional()
  template?: string;

  @ApiPropertyOptional({
    description: 'Additional data for the notification',
    example: { deploymentId: '123', projectName: 'My Project' },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'The read status of the notification',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @ApiPropertyOptional({
    description: 'The status of the notification',
    example: 'delivered',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @IsOptional()
  readAt?: Date;
}
