/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DecodedIdToken } from 'firebase-admin/auth';

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
        firebaseUid: 'some-uid', // This would be overridden by the controller
        company: 'Test Co',
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
      createdUser.firebaseUid = currentUser.uid;
      Object.assign(createdUser, createUserDto);

      const responseDto: UserResponseDto = {
        id: 'test-id',
        firebaseUid: currentUser.uid,
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Co',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'createUser').mockResolvedValue(createdUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.create(createUserDto, currentUser);

      expect(usersService.createUser).toHaveBeenCalledWith({
        ...createUserDto,
        firebaseUid: currentUser.uid,
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

      const foundUser = new User();
      foundUser.id = userId;

      const responseDto: UserResponseDto = {
        id: userId,
        firebaseUid: 'firebase-uid',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'findOne').mockResolvedValue(foundUser);
      jest.spyOn(usersService, 'mapToResponseDto').mockReturnValue(responseDto);

      const result = await controller.findOne(userId, currentUser);

      expect(usersService.findOne).toHaveBeenCalledWith(userId);
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
        firebaseUid: 'firebase-uid',
        firstName: 'Updated',
        lastName: 'Name',
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
        firebaseUid: 'firebase-uid',
        firstName: 'John',
        lastName: 'Doe',
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
});
