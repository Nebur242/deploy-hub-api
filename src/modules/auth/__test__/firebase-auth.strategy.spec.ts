/* eslint-disable @typescript-eslint/no-unused-vars */
import { UsersService } from '@app/modules/users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as firebaseAdmin from 'firebase-admin';
import { FirebaseAuthError } from 'firebase-admin/auth';

import { FirebaseAuthStrategy } from '../firebase-auth.strategy';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
}));

// Mock UsersService
const mockUsersService = {
  findByFirebaseUid: jest.fn(),
};

describe('FirebaseAuthStrategy', function (this: void) {
  let strategy: FirebaseAuthStrategy;
  let mockAuth: {
    verifyIdToken: jest.Mock;
  };
  let usersService: UsersService;

  beforeEach(async function (this: void) {
    // Setup mock for firebase-admin/auth
    mockAuth = {
      verifyIdToken: jest.fn(),
    };

    (firebaseAdmin.auth as jest.Mock).mockReturnValue(mockAuth);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    strategy = module.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(function (this: void) {
    jest.clearAllMocks();
  });

  it('should be defined', function (this: void) {
    expect(strategy).toBeDefined();
  });

  describe('validate', function (this: void) {
    it('should return the firebase user when token is valid and user not found', async function (this: void) {
      const mockFirebaseUser = { uid: 'user123', email: 'test@example.com' };
      mockAuth.verifyIdToken.mockResolvedValueOnce(mockFirebaseUser);
      mockUsersService.findByFirebaseUid.mockResolvedValueOnce(null);

      const result = await strategy.validate('valid-token');

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockFirebaseUser);
    });

    it('should return the user when token is valid and user is found', async function (this: void) {
      const mockFirebaseUser = { uid: 'user123', email: 'test@example.com' };
      const mockUser = { id: 1, firebaseUid: 'user123', email: 'test@example.com' };
      mockAuth.verifyIdToken.mockResolvedValueOnce(mockFirebaseUser);
      mockUsersService.findByFirebaseUid.mockResolvedValueOnce(mockUser);

      const result = await strategy.validate('valid-token');

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockUser);
    });

    it('should return firebase user when user service throws an error', async function (this: void) {
      const mockFirebaseUser = { uid: 'user123', email: 'test@example.com' };
      mockAuth.verifyIdToken.mockResolvedValueOnce(mockFirebaseUser);
      mockUsersService.findByFirebaseUid.mockRejectedValueOnce(new Error('Database error'));

      const result = await strategy.validate('valid-token');

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockFirebaseUser);
    });

    it('should throw UnauthorizedException when token verification fails with error message', async function (this: void) {
      const authError = new Error('Token expired') as FirebaseAuthError;
      mockAuth.verifyIdToken.mockRejectedValueOnce(authError);

      await expect(strategy.validate('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Token expired'),
      );
      expect(mockUsersService.findByFirebaseUid).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with default message when error has no message', async function (this: void) {
      // Create an error object without a message
      const authError = Object.create(Error.prototype) as FirebaseAuthError;
      mockAuth.verifyIdToken.mockRejectedValueOnce(authError);

      await expect(strategy.validate('invalid-token')).rejects.toThrow(
        new UnauthorizedException('unauthorized'),
      );
    });

    it('should throw UnauthorizedException with default message for generic errors', async function (this: void) {
      // A generic error without FirebaseAuthError structure
      mockAuth.verifyIdToken.mockRejectedValueOnce(new Error());

      await expect(strategy.validate('invalid-token')).rejects.toThrow(
        new UnauthorizedException('unauthorized'),
      );
    });
  });

  describe('constructor', function (this: void) {
    it('should set up the strategy with bearer token extractor', function (this: void) {
      expect(strategy).toBeInstanceOf(FirebaseAuthStrategy);
    });
  });
});
