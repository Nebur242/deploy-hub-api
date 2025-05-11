import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationType } from '../enums/notification-type.enum';

export class DeviceInfoDto {
  @ApiProperty({ description: 'The token string' })
  token: string;

  @ApiPropertyOptional({ description: 'Device platform' })
  platform?: string;

  @ApiPropertyOptional({ description: 'Browser name' })
  browser?: string;

  @ApiPropertyOptional({ description: 'Browser/app version' })
  version?: string;

  @ApiPropertyOptional({ description: 'Device name' })
  deviceName?: string;

  @ApiPropertyOptional({ description: 'When the token was added' })
  addedAt?: Date;

  @ApiPropertyOptional({ description: 'When the token was last active' })
  lastActive?: Date;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    enum: NotificationType,
    description: 'Type of notifications',
  })
  type: NotificationType;

  @ApiProperty({
    type: [String],
    description: 'Array of token strings',
  })
  tokens: string[];

  @ApiPropertyOptional({
    type: [DeviceInfoDto],
    description: 'Device information for tokens',
  })
  deviceInfo?: DeviceInfoDto[];

  @ApiProperty({ description: 'Token record creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Token record last update date' })
  updatedAt: Date;
}
