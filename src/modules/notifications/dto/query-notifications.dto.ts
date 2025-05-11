import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsString,
  IsArray,
  MaxLength,
  IsDate,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

import { NotificationScope } from '../entities/notification.enty';
import { NotificationType } from '../enums/notification-type.enum';

export class QueryNotificationsDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 10))
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by notification types',
    isArray: true,
    enum: NotificationType,
    example: [NotificationType.SYSTEM, NotificationType.EMAIL],
  })
  @IsEnum(NotificationType, { each: true })
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: string[] | string }) => {
    // Handle both array and comma-separated string formats
    if (typeof value === 'string') {
      return value.split(',').map(val => val.trim());
    }
    return value;
  })
  types?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Filter by notification scopes',
    isArray: true,
    enum: NotificationScope,
    example: [NotificationScope.DEPLOYMENT, NotificationScope.PROJECTS],
  })
  @IsEnum(NotificationScope, { each: true })
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: string[] | string }) => {
    // Handle both array and comma-separated string formats
    if (typeof value === 'string') {
      return value.split(',').map(val => val.trim());
    }
    return value;
  })
  scopes?: NotificationScope[];

  @ApiPropertyOptional({
    description: 'Filter by read status',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    return value === 'true' || value === true;
  })
  read?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    example: 'delivered',
    enum: ['pending', 'delivered', 'sent', 'failed', 'processing'],
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @IsIn(['pending', 'delivered', 'sent', 'failed', 'processing'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Search in notification message',
    example: 'deployment',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by date range (from)',
    example: '2023-01-01T00:00:00Z',
  })
  @IsDate()
  @IsOptional()
  @Transform(({ value }) => {
    if (value) {
      return new Date(value);
    }
    return undefined;
  })
  dateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter by date range (to)',
    example: '2023-12-31T23:59:59Z',
  })
  @IsDate()
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value) {
      const date = new Date(value);
      // Set to end of day if no time is specified
      if (value.includes('T') === false) {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    }
    return undefined;
  })
  dateTo?: Date;

  @ApiPropertyOptional({
    description: 'Filter by recipient (email, phone number, etc.)',
    example: 'user@example.com',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  recipient?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'processedAt', 'readAt'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'processedAt', 'readAt'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Priority level filter',
    example: 1,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value) {
      return parseInt(value, 10);
    }
    return undefined;
  })
  priority?: number;

  @ApiPropertyOptional({
    description: 'Template used for the notification',
    example: 'welcome-email',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  template?: string;

  @ApiPropertyOptional({
    description: 'Filter by error presence',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    return value === 'true' || value === true;
  })
  hasError?: boolean;

  @ApiPropertyOptional({
    description: 'Include full data object in response',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    return value === 'true' || value === true;
  })
  includeData?: boolean;

  @ApiPropertyOptional({
    description: 'Group notifications by a specific field',
    example: 'type',
    enum: ['type', 'status', 'template', 'read'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['type', 'status', 'template', 'read'])
  groupBy?: string;

  @ApiPropertyOptional({
    description: 'Filter notifications processed after this date',
    example: '2023-01-01T00:00:00Z',
  })
  @IsDate()
  @IsOptional()
  @Transform(({ value }) => {
    if (value) {
      return new Date(value);
    }
    return undefined;
  })
  processedAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter notifications read after this date',
    example: '2023-01-01T00:00:00Z',
  })
  @IsDate()
  @IsOptional()
  @Transform(({ value }) => {
    if (value) {
      return new Date(value);
    }
    return undefined;
  })
  readAfter?: Date;
}

// Create a partial DTO for update operations that only accepts specific fields
export class UpdateQueryNotificationsDto {
  @ApiPropertyOptional({
    description: 'Update read status for filtered notifications',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  markAsRead?: boolean;

  @ApiPropertyOptional({
    description: 'Delete filtered notifications',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  deleteNotifications?: boolean;
}

// Helper to validate date ranges
export function validateDateRange(dto: QueryNotificationsDto): void {
  if (dto.dateFrom && dto.dateTo && dto.dateFrom > dto.dateTo) {
    throw new Error('dateFrom must be before dateTo');
  }

  if (dto.processedAfter && dto.dateFrom && dto.processedAfter < dto.dateFrom) {
    throw new Error('processedAfter must be after dateFrom');
  }

  if (dto.readAfter && dto.dateFrom && dto.readAfter < dto.dateFrom) {
    throw new Error('readAfter must be after dateFrom');
  }
}
