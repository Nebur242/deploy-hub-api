import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';

export class NotificationResponseDto {
  @ApiProperty({
    description: 'The notification ID',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The notification type',
    enum: NotificationType,
    example: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @ApiProperty({
    description: 'The user ID the notification is for',
    example: '550e8400-e29b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'The recipient of the notification (e.g., email address)',
    example: 'user@example.com',
  })
  recipient?: string;

  @ApiPropertyOptional({
    description: 'The subject of the notification',
    example: 'Deployment Complete',
  })
  subject?: string;

  @ApiProperty({
    description: 'The notification message',
    example: 'Your deployment has been completed successfully.',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'The template used for the notification',
    example: 'deployment-complete',
  })
  template?: string;

  @ApiPropertyOptional({
    description: 'Additional data for the notification',
    type: Object,
  })
  data?: Record<string, any>;

  @ApiProperty({
    description: 'The creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'The processing timestamp',
    example: '2023-01-01T00:05:00Z',
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'The notification status',
    example: 'delivered',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Error message if delivery failed',
    example: 'Email address not found',
  })
  error?: string;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  read: boolean;

  @ApiPropertyOptional({
    description: 'The timestamp when notification was read',
    example: '2023-01-01T01:00:00Z',
  })
  readAt?: Date;

  @ApiProperty({
    description: 'The last update timestamp',
    example: '2023-01-01T00:05:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User information (optional, depends on include flag)',
    type: () => User,
  })
  user?: User;
}
