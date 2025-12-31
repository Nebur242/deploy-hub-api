import { OrderStatus } from '@app/shared/enums';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationMeta, Pagination, paginate } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';

import { LicensedProjectsQueryDto } from './dto/licensed-projects.dto';
import { UserNotificationDto } from './dto/user-notification.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { UserNotification } from './entities/user-notification.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { User } from './entities/user.entity';
import { UserCreatedEvent, UserEventType } from './events/user.events';
import { NotificationScope } from '../notifications/entities/notification.enty';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationService } from '../notifications/services/notification.service';
import { Order } from '../order/entities/order.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreferences)
    private preferencesRepository: Repository<UserPreferences>,
    @InjectRepository(UserNotification)
    private notificationRepository: Repository<UserNotification>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Check if user with firebase UID already exists
    const existingUser = await this.userRepository.findOne({
      where: { uid: createUserDto.uid },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Create default preferences
    const preferences = this.preferencesRepository.create();
    await this.preferencesRepository.save(preferences);

    // Create default notifications
    const notifications = this.notificationRepository.create();
    await this.notificationRepository.save(notifications);

    // Create the user
    // Keys now match between DTO and Entity (snake_case)
    const user = this.userRepository.create({
      ...createUserDto,
      preferences,
      notifications,
    });

    const savedUser = await this.userRepository.save(user);

    // Emit user created event for notifications
    this.eventEmitter.emit(
      UserEventType.USER_CREATED,
      new UserCreatedEvent(
        savedUser.id,
        savedUser,
        savedUser.email,
        savedUser.first_name || '',
        savedUser.last_name || '',
      ),
    );

    return savedUser;
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({ relations: ['preferences', 'notifications'] });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['preferences', 'notifications'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async findByFirebaseUid(uid: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { uid },
      relations: ['preferences', 'notifications'],
    });

    if (!user) {
      throw new NotFoundException(`User with Firebase UID "${uid}" not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async updatePreferences(id: string, preferencesDto: UserPreferencesDto): Promise<User> {
    const user = await this.findOne(id);

    // Keys now match (snake_case)
    Object.assign(user.preferences, preferencesDto);

    await this.preferencesRepository.save(user.preferences);
    return user;
  }

  async updateNotifications(id: string, notificationDto: UserNotificationDto): Promise<User> {
    const user = await this.findOne(id);

    // Create notifications if they don't exist
    if (!user.notifications) {
      const notifications = this.notificationRepository.create();
      await this.notificationRepository.save(notifications);
      user.notifications = notifications;
    }

    // Update only the provided notification fields
    Object.assign(user.notifications, notificationDto);
    await this.notificationRepository.save(user.notifications);

    return user;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  // User to response DTO mapper
  mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      uid: user.uid,
      first_name: user?.first_name,
      last_name: user?.last_name,
      company: user.company,
      preferences: user.preferences,
      notifications: user.notifications,
      roles: user.roles,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Get projects that the user has access to via purchased licenses
   * @param userId The user's ID
   * @param query Query parameters for filtering and pagination
   * @returns Paginated list of projects the user has access to through licenses
   */
  async getLicensedProjects(
    userId: string,
    query: LicensedProjectsQueryDto,
  ): Promise<Pagination<Project, IPaginationMeta>> {
    const { page = 1, limit = 10, visibility, search, licenseId } = query;

    // First get project IDs from user's active licenses
    const projectQuery = this.orderRepository
      .createQueryBuilder('order')
      .select('DISTINCT project.id', 'id')
      .innerJoin('order.license', 'license')
      .innerJoin('license.projects', 'project')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.isActive = :isActive', { isActive: true })
      .andWhere('(order.expiresAt IS NULL OR order.expiresAt > :now)', { now: new Date() });

    // Apply optional filters
    if (visibility) {
      projectQuery.andWhere('project.visibility = :visibility', { visibility });
    }

    if (search) {
      projectQuery.andWhere('(project.name ILIKE :search OR project.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (licenseId) {
      projectQuery.andWhere('license.id = :licenseId', { licenseId });
    }

    // Get only the IDs first to use in the next query
    const projectIdsResult = await projectQuery.getRawMany<{ id: string | number }>();
    const projectIds: string[] = projectIdsResult.map(item =>
      typeof item.id === 'string' ? item.id : String(item.id),
    );

    // If no projects found, return empty response
    if (!projectIds.length) {
      return {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: limit,
          totalPages: 0,
          currentPage: page,
        },
        links: {
          first: '',
          previous: '',
          next: '',
          last: '',
        },
      };
    }

    // Now get the complete project data with their licenses and configurations
    const projectDataQuery = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.licenses', 'licenses')
      .leftJoinAndSelect('project.configurations', 'configurations')
      .where('project.id IN (:...projectIds)', { projectIds });

    // Create pagination options
    const paginationOptions = {
      page,
      limit,
    };

    // Execute the paginated query
    const paginatedProjects = await paginate<Project>(projectDataQuery, paginationOptions);

    // Map projects to response DTO format

    // Return paginated response
    return {
      items: paginatedProjects.items,
      meta: paginatedProjects.meta,
      links: paginatedProjects.links,
    };
  }

  /**
   * Sends a welcome email notification to a newly created user.
   *
   * @param user - The user to send the welcome email to
   * @returns A promise resolving to void
   */
  async sendWelcomeEmailNotification(user: User & { email: string }): Promise<void> {
    const first_name = user.first_name || 'User';

    await this.notificationService.create({
      type: NotificationType.EMAIL,
      userId: user.id,
      recipient: user.email,
      subject: 'Welcome to Deploy Hub!',
      message: `Welcome to Deploy Hub, ${first_name}! We're excited to have you on board.`,
      scope: NotificationScope.WELCOME, // Enum value for template
      data: {
        firstName: first_name,
        logoUrl: process.env.LOGO_URL || 'https://deployhub.app/logo.png',
        dashboardUrl: process.env.DASHBOARD_URL || 'https://deployhub.app/dashboard',
        docsUrl: process.env.DOCS_URL || 'https://deployhub.app/docs',
        supportUrl: process.env.SUPPORT_URL || 'https://deployhub.app/support',
        contactUrl: process.env.CONTACT_URL || 'https://deployhub.app/contact',
        year: new Date().getFullYear(),
      },
    });
  }
}
