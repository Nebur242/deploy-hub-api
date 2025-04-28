/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotificationDto } from '../dto/user-notification.dto';
import { UserPreferencesDto } from '../dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserNotification } from '../entities/user-notification.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';

const mockUserRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockPreferencesRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockNotificationRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;
  let preferencesRepository: Repository<UserPreferences>;
  let notificationRepository: Repository<UserNotification>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserPreferences),
          useFactory: mockPreferencesRepository,
        },
        {
          provide: getRepositoryToken(UserNotification),
          useFactory: mockNotificationRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    preferencesRepository = module.get(getRepositoryToken(UserPreferences));
    notificationRepository = module.get(getRepositoryToken(UserNotification));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user with default preferences and notifications', async () => {
      const createUserDto: CreateUserDto = {
        uid: 'test-uid',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
      };

      const preferences = new UserPreferences();
      const notifications = new UserNotification();
      const newUser = new User();
      Object.assign(newUser, createUserDto);
      newUser.preferences = preferences;
      newUser.notifications = notifications;

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(preferencesRepository, 'create').mockReturnValue(preferences);
      jest.spyOn(preferencesRepository, 'save').mockResolvedValue(preferences);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(notifications);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(notifications);
      jest.spyOn(userRepository, 'create').mockReturnValue(newUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue(newUser);

      const result = await service.createUser(createUserDto);

      expect(preferencesRepository.create).toHaveBeenCalled();
      expect(preferencesRepository.save).toHaveBeenCalledWith(preferences);
      expect(notificationRepository.create).toHaveBeenCalled();
      expect(notificationRepository.save).toHaveBeenCalledWith(notifications);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        preferences,
        notifications,
      });
      expect(result).toEqual(newUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      const createUserDto: CreateUserDto = {
        uid: 'existing-uid',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
      };

      const existingUser = new User();
      existingUser.uid = createUserDto.uid;

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser);

      await expect(service.createUser(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const user1 = new User();
      const user2 = new User();
      const result = [user1, user2];

      jest.spyOn(userRepository, 'find').mockResolvedValue(result);

      expect(await service.findAll()).toBe(result);
      expect(userRepository.find).toHaveBeenCalledWith({
        relations: ['preferences', 'notifications'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const user = new User();
      user.id = 'test-id';

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      expect(await service.findOne('test-id')).toBe(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        relations: ['preferences', 'notifications'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByFirebaseUid', () => {
    it('should return a user if found', async () => {
      const user = new User();
      user.uid = 'test-uid';

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      expect(await service.findByFirebaseUid('test-uid')).toBe(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { uid: 'test-uid' },
        relations: ['preferences', 'notifications'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findByFirebaseUid('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return a user', async () => {
      const user = new User();
      user.id = 'test-id';
      user.firstName = 'Old Name';

      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated Name',
      };

      const updatedUser = new User();
      Object.assign(updatedUser, user, updateUserDto);

      jest.spyOn(service, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser);

      const result = await service.update('test-id', updateUserDto);

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(userRepository.save).toHaveBeenCalledWith({
        ...user,
        ...updateUserDto,
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences and return user', async () => {
      const preferences = new UserPreferences();
      preferences.id = 'pref-id';

      const user = new User();
      user.id = 'test-id';
      user.preferences = preferences;

      const preferencesDto: UserPreferencesDto = {
        emailNotifications: false,
      };

      const updatedPreferences = new UserPreferences();
      Object.assign(updatedPreferences, preferences, preferencesDto);

      const updatedUser = new User();
      Object.assign(updatedUser, user);
      updatedUser.preferences = updatedPreferences;

      jest.spyOn(service, 'findOne').mockResolvedValue(user);
      jest.spyOn(preferencesRepository, 'save').mockResolvedValue(updatedPreferences);

      const result = await service.updatePreferences('test-id', preferencesDto);

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(preferencesRepository.save).toHaveBeenCalledWith({
        ...preferences,
        ...preferencesDto,
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updateNotifications', () => {
    it('should update notifications and return user', async () => {
      const notifications = new UserNotification();
      notifications.id = 'notify-id';

      const user = new User();
      user.id = 'test-id';
      user.notifications = notifications;

      const notificationDto: UserNotificationDto = {
        marketing: true,
        projectUpdates: false,
      };

      const updatedNotifications = new UserNotification();
      Object.assign(updatedNotifications, notifications, notificationDto);

      const updatedUser = new User();
      Object.assign(updatedUser, user);
      updatedUser.notifications = updatedNotifications;

      jest.spyOn(service, 'findOne').mockResolvedValue(user);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(updatedNotifications);

      const result = await service.updateNotifications('test-id', notificationDto);

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(notificationRepository.save).toHaveBeenCalledWith({
        ...notifications,
        ...notificationDto,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should create notifications if they do not exist and return user', async () => {
      const user = new User();
      user.id = 'test-id';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user.notifications = undefined as any;

      const notificationDto: UserNotificationDto = {
        marketing: true,
        projectUpdates: false,
      };

      const createdNotifications = new UserNotification();
      createdNotifications.id = 'new-notify-id';
      Object.assign(createdNotifications, notificationDto);

      const updatedUser = new User();
      Object.assign(updatedUser, user);
      updatedUser.notifications = createdNotifications;

      jest.spyOn(service, 'findOne').mockResolvedValue(user);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(createdNotifications);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(createdNotifications);

      const result = await service.updateNotifications('test-id', notificationDto);

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(notificationRepository.create).toHaveBeenCalled();
      expect(notificationRepository.save).toHaveBeenCalledWith(createdNotifications);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const user = new User();
      user.id = 'test-id';

      jest.spyOn(service, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'remove').mockResolvedValue(undefined as any);

      await service.remove('test-id');

      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(userRepository.remove).toHaveBeenCalledWith(user);
    });
  });

  describe('mapToResponseDto', () => {
    it('should map user entity to response DTO', () => {
      const preferences = new UserPreferences();
      const notifications = new UserNotification();

      const user = new User();
      user.id = 'test-id';
      user.uid = 'test-uid';
      user.firstName = 'John';
      user.lastName = 'Doe';
      user.company = 'Test Co';
      user.profilePicture = 'profile.jpg';
      user.preferences = preferences;
      user.notifications = notifications;
      user.createdAt = new Date();
      user.updatedAt = new Date();

      const result = service.mapToResponseDto(user);

      expect(result).toEqual({
        id: user.id,
        uid: user.uid,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        profilePicture: user.profilePicture,
        preferences: user.preferences,
        notifications: user.notifications,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    });
  });
});
