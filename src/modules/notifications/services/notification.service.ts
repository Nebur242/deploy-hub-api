import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Between, FindOptionsWhere, ILike, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { NOTIFICATION_QUEUE } from '../../queue/constants/notification-queue.constants';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationEntity, NotificationHbsTemplate } from '../entities/notification.enty';
import { NotificationRepository } from '../repositories/notification.repository';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * Create a new notification
   * @param createNotificationDto The notification data
   * @returns The created notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      template: createNotificationDto.scope
        ? NotificationHbsTemplate[createNotificationDto.scope]
        : undefined,
    });
    const savedNotification = await this.notificationRepository.save(notification);

    // Add notification to the queue for processing
    await this.notificationQueue.add('process-notification', {
      notificationId: savedNotification.id,
    });

    return savedNotification;
  }

  /**
   * Find all notifications with pagination and filtering
   * @param queryDto Query parameters for filtering
   * @returns Paginated list of notifications
   */
  findAll(queryDto: QueryNotificationsDto): Promise<Pagination<NotificationEntity>> {
    const {
      page = 1,
      limit = 10,
      userId,
      types,
      read,
      status,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      template,
      hasError,
      includeData,
      groupBy,
      processedAfter,
      readAfter,
    } = queryDto;

    // Build where conditions
    const where: FindOptionsWhere<NotificationEntity> = {};

    if (userId) {
      where.userId = userId;
    }

    if (types && types.length > 0) {
      where.type = types.length === 1 ? types[0] : In(types);
    }

    if (read !== undefined) {
      where.read = read;
    }

    if (status) {
      where.status = status;
    }

    if (template) {
      where.template = template;
    }

    if (hasError) {
      where.error = ILike('%');
    }

    if (search) {
      where.message = ILike(`%${search}%`);
    }

    if (dateFrom) {
      where.createdAt = MoreThanOrEqual(dateFrom);
    }

    if (dateTo) {
      where.createdAt = dateTo
        ? dateFrom
          ? Between(dateFrom, dateTo)
          : LessThanOrEqual(dateTo)
        : where.createdAt;
    }

    if (processedAfter) {
      where.processedAt = MoreThanOrEqual(processedAfter);
    }

    if (readAfter) {
      where.readAt = MoreThanOrEqual(readAfter);
    }

    // Build query
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where(where);

    // Group by functionality
    if (groupBy) {
      queryBuilder.groupBy(`notification.${groupBy}`);
    }

    // Add user data if requested
    if (includeData) {
      queryBuilder.leftJoinAndSelect('notification.user', 'user');
    }

    // Add sorting
    queryBuilder.orderBy(`notification.${sortBy}`, sortOrder);

    // Create pagination options
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/notifications', // Base route for pagination links
    };

    // Use paginate function from nestjs-typeorm-paginate
    return paginate<NotificationEntity>(queryBuilder, paginationOptions);
  }

  /**
   * Find one notification by ID
   * @param id The notification ID
   * @returns The notification
   * @throws NotFoundException if notification doesn't exist
   */
  async findOne(id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID: ${id} not found`);
    }

    return notification;
  }

  /**
   * Update a notification
   * @param id The notification ID
   * @param updateNotificationDto The data to update
   * @returns The updated notification
   * @throws NotFoundException if notification doesn't exist
   */
  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationEntity> {
    const notification = await this.findOne(id);

    // Handle read status changes
    if (
      updateNotificationDto.read !== undefined &&
      updateNotificationDto.read !== notification.read &&
      updateNotificationDto.readAt
    ) {
      updateNotificationDto.readAt = updateNotificationDto.read ? new Date() : undefined;
    }

    const updatedNotification = {
      ...notification,
      ...updateNotificationDto,
    };

    return this.notificationRepository.save(updatedNotification);
  }

  /**
   * Mark a notification as read
   * @param id The notification ID
   * @returns The updated notification
   */
  markAsRead(id: string): Promise<NotificationEntity> {
    return this.update(id, { read: true });
  }

  /**
   * Mark all notifications for a user as read
   * @param userId The user ID
   * @param types Optional array of notification types to filter by
   * @returns The operation result
   */
  async markAllAsRead(userId: string, types?: string[]): Promise<{ affected: number }> {
    const where: FindOptionsWhere<NotificationEntity> = { userId, read: false };

    // Filter by types if provided
    if (types && types.length > 0) {
      where.type = In(types);
    }

    const result = await this.notificationRepository.update(where, {
      read: true,
      readAt: new Date(),
    });

    return { affected: result.affected || 0 };
  }

  /**
   * Remove a notification
   * @param id The notification ID
   * @returns The operation result
   */
  async remove(id: string): Promise<{ deleted: boolean }> {
    const notification = await this.findOne(id);
    await this.notificationRepository.remove(notification);
    return { deleted: true };
  }

  /**
   * Count unread notifications for a user
   * @param userId The user ID
   * @param types Optional array of notification types to filter by
   * @returns The count of unread notifications
   */
  async countUnread(userId: string, types?: string[]): Promise<{ count: number }> {
    const where: FindOptionsWhere<NotificationEntity> = { userId, read: false };

    // Filter by types if provided
    if (types && types.length > 0) {
      where.type = In(types);
    }

    const count = await this.notificationRepository.count({ where });

    return { count };
  }
}
