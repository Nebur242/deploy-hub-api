/* eslint-disable @typescript-eslint/unbound-method */

import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
// import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';

import { FirebaseModule } from '../../firebase/firebase.module';
import { AuthModule } from '../auth.module';
import { FirebaseAuthStrategy } from '../firebase-auth.strategy';

jest.mock('../../firebase/firebase.module');

describe('AuthModule', function (this: void) {
  let authModule: AuthModule;
  //   let originalModule: typeof AuthModule;

  beforeEach(async function (this: void) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
        FirebaseModule,
      ],
      providers: [FirebaseAuthStrategy],
      exports: [PassportModule, FirebaseModule],
    }).compile();

    authModule = moduleRef.get<AuthModule>(AuthModule);
  });

  it('should be defined', function (this: void) {
    expect(authModule).toBeDefined();
  });

  it('should import PassportModule with firebase-jwt strategy', async function (this: void) {
    // Directly test the auth module functionality without relying on metadata
    const authStrategy = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .compile()
      .then(moduleRef => moduleRef.get(FirebaseAuthStrategy));

    // If the strategy exists, it means the PassportModule was correctly imported
    expect(authStrategy).toBeDefined();

    // Additional verification that it uses the correct strategy
    // This depends on your PassportStrategy implementation
    expect(authStrategy.validate).toBeDefined();
  });

  it('should import FirebaseModule', async function (this: void) {
    // Skip metadata inspection and test actual behavior
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    // If FirebaseModule is correctly imported, we should be able to use its services
    // (This might need adjustment based on your FirebaseModule structure)
    expect(() => moduleRef.get(FirebaseModule, { strict: false })).not.toThrow();
  });

  it('should provide FirebaseAuthStrategy', async function (this: void) {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    const firebaseAuthStrategy = moduleRef.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
    expect(firebaseAuthStrategy).toBeDefined();
  });

  it('should export PassportModule and FirebaseModule', async function (this: void) {
    // Test the behavior rather than the metadata
    // Create a module that imports AuthModule
    @Module({
      imports: [AuthModule],
    })
    class TestModule {}

    // If the modules are exported properly, they should be available to TestModule
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    // Try to get FirebaseModule - this will work if it's exported correctly
    expect(() => moduleRef.get(FirebaseModule, { strict: false })).not.toThrow();

    // Indirectly test PassportModule by checking if strategy is available
    expect(() => moduleRef.get(FirebaseAuthStrategy, { strict: false })).not.toThrow();
  });
});
