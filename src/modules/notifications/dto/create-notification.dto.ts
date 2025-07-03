import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'The type of notification',
    enum: NotificationType,
    example: NotificationType.SYSTEM,
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiPropertyOptional({
    description: 'The scope of the notification',
    enum: NotificationScope,
    example: NotificationScope.DEPLOYMENT,
  })
  @IsEnum(NotificationScope)
  @IsOptional()
  scope?: NotificationScope;

  @ApiProperty({
    description: 'The user ID the notification is for',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'The recipient of the notification (e.g., email address)',
    example: 'user@example.com',
  })
  @IsString()
  @IsOptional()
  recipient?: string;

  @ApiPropertyOptional({
    description: 'The subject of the notification',
    example: 'Deployment Complete',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({
    description: 'The notification message',
    example: 'Your deployment has been completed successfully.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'The template identifier to use',
    example: 'deployment-complete',
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
}
