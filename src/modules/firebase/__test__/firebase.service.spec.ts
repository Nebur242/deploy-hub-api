/* eslint-disable @typescript-eslint/unbound-method */

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

// Mock the entire firebase-admin/auth module
const mockAuth = {
  verifyIdToken: jest.fn(),
  createUser: jest.fn(),
  getUser: jest.fn(),
  listUsers: jest.fn(),
  deleteUser: jest.fn(),
};

// Mock the firebase-admin/auth module
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => mockAuth,
}));

import { FirebaseService } from '../firebase.service';

describe('FirebaseService', () => {
  let service: FirebaseService;
  let httpService: HttpService;

  beforeEach(async () => {
    // Reset all mock implementations before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation(key => {
              if (key === 'FIREBASE_REST_API_KEY') {
                return 'mock-api-key';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyToken', () => {
    it('should call firebase auth verifyIdToken with trimmed token', async () => {
      const mockDecodedToken = { uid: 'user123' };
      mockAuth.verifyIdToken.mockResolvedValueOnce(mockDecodedToken);

      const result = await service.verifyToken('Bearer token123');

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('token123', false);
      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw BadRequestException when verifyIdToken fails', async () => {
      mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(service.verifyToken('token123')).rejects.toThrow('Firebase error');
    });
  });

  describe('createUser', () => {
    it('should call firebase auth createUser with email and password', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      mockAuth.createUser.mockResolvedValueOnce(mockUser);

      const result = await service.createUser('test@example.com', 'password123');

      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when createUser fails', async () => {
      mockAuth.createUser.mockRejectedValueOnce({
        code: 'auth/email-already-exists',
        message: 'Email already exists',
        response: {
          data: {
            error: {
              message: 'Email already exists',
            },
          },
        },
      });

      await expect(service.createUser('test@example.com', 'password123')).rejects.toThrow(
        'Email already exists',
      );
    });
  });

  describe('getUser', () => {
    it('should call firebase auth getUser with uid', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValueOnce(mockUser);

      const result = await service.getUser('user123');

      expect(mockAuth.getUser).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when getUser fails', async () => {
      mockAuth.getUser.mockRejectedValueOnce({
        code: 'auth/user-not-found',
        message: 'User not found',
        response: {
          data: {
            error: {
              message: 'User not found',
            },
          },
        },
      });

      await expect(service.getUser('invalid-uid')).rejects.toThrow('User not found');
    });
  });

  describe('getUsers', () => {
    it('should call firebase auth listUsers with default params when not provided', async () => {
      const mockListUsersResult = { users: [{ uid: 'user123' }] };
      mockAuth.listUsers.mockResolvedValueOnce(mockListUsersResult);

      const result = await service.getUsers();

      expect(mockAuth.listUsers).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockListUsersResult);
    });

    it('should call firebase auth listUsers with provided params', async () => {
      const mockListUsersResult = { users: [{ uid: 'user123' }] };
      mockAuth.listUsers.mockResolvedValueOnce(mockListUsersResult);

      const result = await service.getUsers(100, 'page-token');

      expect(mockAuth.listUsers).toHaveBeenCalledWith(100, 'page-token');
      expect(result).toEqual(mockListUsersResult);
    });
  });

  describe('removeUser', () => {
    it('should call firebase auth deleteUser with uid', async () => {
      mockAuth.deleteUser.mockResolvedValueOnce(undefined);

      await service.removeUser('user123');

      expect(mockAuth.deleteUser).toHaveBeenCalledWith('user123');
    });

    it('should throw BadRequestException when deleteUser fails', async () => {
      mockAuth.deleteUser.mockRejectedValueOnce({
        code: 'auth/user-not-found',
        message: 'User not found',
        response: {
          data: {
            error: {
              message: 'User not found',
            },
          },
        },
      });

      await expect(service.removeUser('invalid-uid')).rejects.toThrow('User not found');
    });
  });

  describe('login', () => {
    it('should call firebase REST API for login', async () => {
      const mockResponse = {
        data: { uid: 'user123' },
      } as AxiosResponse;

      jest.spyOn(httpService, 'post').mockReturnValueOnce(of(mockResponse));

      const result = await service.login('test@example.com', 'password123');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=mock-api-key',
        {
          email: 'test@example.com',
          password: 'password123',
          returnSecureToken: true,
        },
      );
      expect(result).toEqual({ uid: 'user123' });
    });

    it('should throw BadRequestException when login fails', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid password',
            },
          },
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValueOnce(throwError(() => mockError));

      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid password',
      );
    });
  });
});
