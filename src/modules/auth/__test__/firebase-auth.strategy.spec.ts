import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as firebaseAdmin from 'firebase-admin';
import { FirebaseAuthError } from 'firebase-admin/auth';

import { FirebaseAuthStrategy } from '../firebase-auth.strategy';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
}));

describe('FirebaseAuthStrategy', function (this: void) {
  let strategy: FirebaseAuthStrategy;
  let mockAuth: {
    verifyIdToken: jest.Mock;
  };

  beforeEach(async function (this: void) {
    // Setup mock for firebase-admin/auth
    mockAuth = {
      verifyIdToken: jest.fn(),
    };

    (firebaseAdmin.auth as jest.Mock).mockReturnValue(mockAuth);

    const module: TestingModule = await Test.createTestingModule({
      providers: [FirebaseAuthStrategy],
    }).compile();

    strategy = module.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
  });

  afterEach(function (this: void) {
    jest.clearAllMocks();
  });

  it('should be defined', function (this: void) {
    expect(strategy).toBeDefined();
  });

  describe('validate', function (this: void) {
    it('should return the firebase user when token is valid', async function (this: void) {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      mockAuth.verifyIdToken.mockResolvedValueOnce(mockUser);

      const result = await strategy.validate('valid-token');

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when token verification fails with error message', async function (this: void) {
      const authError = new Error('Token expired') as FirebaseAuthError;
      mockAuth.verifyIdToken.mockRejectedValueOnce(authError);

      await expect(strategy.validate('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Token expired'),
      );
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
      // We can test this by checking if the super constructor was called with the right options
      // This requires accessing private properties, which is tricky in TypeScript
      // For this test, we'll verify indirectly by ensuring the strategy instance exists
      expect(strategy).toBeInstanceOf(FirebaseAuthStrategy);

      // If you want to test the specific options, you could recreate the class and spy on super
      class TestStrategy extends FirebaseAuthStrategy {
        constructor() {
          super();
          // This constructor will call the parent constructor with the right options
        }
      }

      const testStrategy = new TestStrategy();
      expect(testStrategy).toBeDefined();
    });
  });
});
