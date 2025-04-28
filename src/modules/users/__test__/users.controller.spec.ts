/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DecodedIdToken } from 'firebase-admin/auth';

import { UserNotificationDto } from '../dto/user-notification.dto';
import { UserPreferencesDto } from '../dto/user-preferences.dto';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from '../dto/user.dto';
import { User } from '../entities/user.entity';
import { UserController } from '../users.controller';
import { UsersService } from '../users.service';

const mockUsersService = () => ({
  createUser: jest.fn(),
  findOne: jest.fn(),
  findByFirebaseUid: jest.fn(),
  update: jest.fn(),
  updatePreferences: jest.fn(),
  updateNotifications: jest.fn(),
  remove: jest.fn(),
  mapToResponseDto: jest.fn(),
});

describe('UserController', () => {
  let controller: UserController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UsersService,
          useFactory: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and return response DTO', async () => {
      const createUserDto: CreateUserDto = {
        firstName: 'John',
        lastName: 'Doe',
        uid: 'some-uid', // This would be overridden by the controller
        company: 'Test Co',
        roles: ['user'],
      };

      const currentUser: DecodedIdToken = {
        uid: 'firebase-uid',
        aud: '',
        auth_time: 0,
        exp: 0,
        firebase: { identities: {}, sign_in_provider: '' },
        iat: 0,
        iss: '',
        sub: '',
      };

      const createdUser = new User();
      createdUser.id = 'test-id';
      createdUser.uid = currentUser.uid;
      Object.assign(createdUser, createUserDto);

      const responseDto: UserResponseDto = {
        id: 'test-id',
        uid: currentUser.uid,
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Co',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'createUser').mockResolvedValue(createdUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.create(createUserDto, currentUser);

      expect(usersService.createUser).toHaveBeenCalledWith({
        ...createUserDto,
        uid: currentUser.uid,
      });
      expect(usersService.mapToResponseDto).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(responseDto);
    });
  });

  describe('findOne', () => {
    it('should return a user by id if current user is authorized', async () => {
      const userId = 'test-id';
      const currentUser = new User();
      currentUser.id = userId;
      currentUser.uid = 'firebase-uid';
      currentUser.roles = ['admin']; // Add admin role to bypass authorization

      const foundUser = new User();
      foundUser.id = userId;
      foundUser.uid = 'firebase-uid';

      const responseDto: UserResponseDto = {
        id: userId,
        uid: 'firebase-uid',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'findByFirebaseUid').mockResolvedValue(foundUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.findOne('firebase-uid', currentUser);

      expect(usersService.findByFirebaseUid).toHaveBeenCalledWith('firebase-uid');
      expect(usersService.mapToResponseDto).toHaveBeenCalledWith(foundUser);
      expect(result).toEqual(responseDto);
    });

    it('should throw ForbiddenException if current user is not authorized', async () => {
      const userId = 'test-id';
      const currentUser = new User();
      currentUser.id = 'different-id';

      await expect(controller.findOne(userId, currentUser)).rejects.toThrow(ForbiddenException);
      expect(usersService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a user and return the result', async () => {
      const userId = 'test-id';
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = new User();
      updatedUser.id = userId;
      Object.assign(updatedUser, updateUserDto);

      const responseDto: UserResponseDto = {
        id: userId,
        uid: 'firebase-uid',
        firstName: 'Updated',
        lastName: 'Name',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'update').mockResolvedValue(updatedUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.update(userId, updateUserDto);

      expect(usersService.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(usersService.mapToResponseDto).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(responseDto);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences and return the result', async () => {
      const userId = 'test-id';
      const preferencesDto: UserPreferencesDto = {
        emailNotifications: false,
      };

      const updatedUser = new User();
      updatedUser.id = userId;

      const responseDto: UserResponseDto = {
        id: userId,
        uid: 'firebase-uid',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'updatePreferences').mockResolvedValue(updatedUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.updatePreferences(userId, preferencesDto);

      expect(usersService.updatePreferences).toHaveBeenCalledWith(userId, preferencesDto);
      expect(usersService.mapToResponseDto).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(responseDto);
    });
  });

  describe('updateNotifications', () => {
    it('should update user notifications and return the result', async () => {
      const userId = 'test-id';
      const notificationDto: UserNotificationDto = {
        marketing: true,
        projectUpdates: false,
      };

      const updatedUser = new User();
      updatedUser.id = userId;

      const responseDto: UserResponseDto = {
        id: userId,
        uid: 'firebase-uid',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'updateNotifications').mockResolvedValue(updatedUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.updateNotifications(userId, notificationDto);

      expect(usersService.updateNotifications).toHaveBeenCalledWith(userId, notificationDto);
      expect(usersService.mapToResponseDto).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(responseDto);
    });
  });
});
