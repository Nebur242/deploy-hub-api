import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import { Role } from '@app/shared/enums';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';

import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationEntity } from '../entities/notification.enty';
import { NotificationService } from '../services/notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@Authenticated()
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({
    status: 201,
    description: 'The notification has been successfully created.',
    type: NotificationResponseDto,
  })
  create(@Body() createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications' })
  @ApiResponse({
    status: 200,
    description: 'Return a paginated list of notifications',
    schema: {
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/NotificationResponseDto' },
        },
        meta: {
          properties: {
            totalItems: { type: 'number' },
            itemCount: { type: 'number' },
            itemsPerPage: { type: 'number' },
            totalPages: { type: 'number' },
            currentPage: { type: 'number' },
          },
        },
        links: {
          properties: {
            first: { type: 'string' },
            previous: { type: 'string' },
            next: { type: 'string' },
            last: { type: 'string' },
          },
        },
      },
    },
  })
  findAll(
    @Query() queryDto: QueryNotificationsDto,
    @CurrentUser() user: User,
  ): Promise<Pagination<NotificationEntity>> {
    // If no userId is provided, use the current user's ID (except for admins)
    if (!queryDto.userId && !user.roles.includes(Role.ADMIN)) {
      queryDto.userId = user.id;
    }

    return this.notificationService.findAll(queryDto);
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Count unread notifications' })
  @ApiResponse({
    status: 200,
    description: 'Returns count of unread notifications',
    schema: {
      properties: {
        count: { type: 'number' },
      },
    },
  })
  countUnread(
    @CurrentUser() user: User,
    @Query('types') types?: string,
  ): Promise<{ count: number }> {
    // Parse types from comma-separated string
    const typeArray = types ? types.split(',').map(t => t.trim()) : undefined;
    return this.notificationService.countUnread(user.id, typeArray);
  }

  @Patch('read/all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Returns the number of affected notifications',
    schema: {
      properties: {
        affected: { type: 'number' },
      },
    },
  })
  markAllAsRead(
    @CurrentUser() user: User,
    @Query('types') types?: string,
  ): Promise<{ affected: number }> {
    // Parse types from comma-separated string
    const typeArray = types ? types.split(',').map(t => t.trim()) : undefined;
    return this.notificationService.markAllAsRead(user.id, typeArray);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the notification',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
    // @CurrentUser() user: User,
  ): Promise<NotificationEntity> {
    return this.notificationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully updated.',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationEntity> {
    return this.notificationService.update(id, updateNotificationDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been marked as read',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  markAsRead(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
  ): Promise<NotificationEntity> {
    return this.notificationService.markAsRead(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully deleted.',
    schema: {
      properties: {
        deleted: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
  ): Promise<{ deleted: boolean }> {
    return this.notificationService.remove(id);
  }
}
