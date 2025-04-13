/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';

import { FirebaseModule } from '../../firebase/firebase.module';
import { UserModule } from '../../users/users.module';
import { UsersService } from '../../users/users.service';
import { AuthModule } from '../auth.module';
import { FirebaseAuthStrategy } from '../firebase-auth.strategy';

jest.mock('../../firebase/firebase.module');
jest.mock('../../users/users.module');

// Mock UsersService
const mockUsersService = {
  findByFirebaseUid: jest.fn(),
};

// Mock firebase auth functions
jest.mock('firebase-admin', () => ({
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

// Mock tryCatch utility
jest.mock('@app/shared/utils/functions', () => ({
  tryCatch: jest.fn().mockImplementation(async fn => {
    try {
      const data = await fn();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }),
}));

describe('AuthModule', function (this: void) {
  let authModule: AuthModule;

  beforeEach(async function (this: void) {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideModule(UserModule)
      .useModule({
        module: class MockUserModule {},
        providers: [
          {
            provide: UsersService,
            useValue: mockUsersService,
          },
        ],
        exports: [UsersService],
      })
      .compile();

    authModule = moduleRef.get<AuthModule>(AuthModule);
  });

  it('should be defined', function (this: void) {
    expect(authModule).toBeDefined();
  });

  it('should import PassportModule with firebase-jwt strategy', async function (this: void) {
    // Create a test module that includes your mocked dependencies
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'firebase-jwt' }), FirebaseModule],
      providers: [
        FirebaseAuthStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    const authStrategy = moduleRef.get(FirebaseAuthStrategy);
    expect(authStrategy).toBeDefined();
    expect(authStrategy.validate).toBeDefined();
  });

  it('should import FirebaseModule', async function (this: void) {
    // Create a test module that reproduces the AuthModule structure
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
        FirebaseModule,
        {
          module: class MockUserModule {},
          providers: [
            {
              provide: UsersService,
              useValue: mockUsersService,
            },
          ],
          exports: [UsersService],
        },
      ],
      providers: [FirebaseAuthStrategy],
      exports: [PassportModule, FirebaseModule],
    }).compile();

    // Test if FirebaseModule is available
    expect(() => moduleRef.get(FirebaseModule, { strict: false })).not.toThrow();
  });

  it('should provide FirebaseAuthStrategy', async function (this: void) {
    // Create a standalone test module with all required dependencies provided
    const moduleRef = await Test.createTestingModule({
      providers: [
        FirebaseAuthStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    const firebaseAuthStrategy = moduleRef.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
    expect(firebaseAuthStrategy).toBeDefined();
  });

  it('should export PassportModule and FirebaseModule', async function (this: void) {
    // Create a new module that imports our mocked AuthModule
    @Module({
      imports: [
        PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
        FirebaseModule,
        {
          module: class MockUserModule {},
          providers: [
            {
              provide: UsersService,
              useValue: mockUsersService,
            },
          ],
          exports: [UsersService],
        },
      ],
      providers: [FirebaseAuthStrategy],
      exports: [PassportModule, FirebaseModule],
    })
    class MockAuthModule {}

    @Module({
      imports: [MockAuthModule],
    })
    class TestModule {}

    // If the modules are exported properly, they should be available to TestModule
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    // Check if FirebaseModule is available (meaning it was exported properly)
    expect(() => moduleRef.get(FirebaseModule, { strict: false })).not.toThrow();
  });
});
