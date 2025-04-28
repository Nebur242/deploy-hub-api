import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotificationDto } from './dto/user-notification.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { UserNotification } from './entities/user-notification.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreferences)
    private preferencesRepository: Repository<UserPreferences>,
    @InjectRepository(UserNotification)
    private notificationRepository: Repository<UserNotification>,
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
    const user = this.userRepository.create({
      ...createUserDto,
      preferences,
      notifications,
    });

    return this.userRepository.save(user);
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
    // Update only the provided preference fields
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
      firstName: user?.firstName,
      lastName: user?.lastName,
      company: user.company,
      preferences: user.preferences,
      notifications: user.notifications,
      roles: user.roles,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
