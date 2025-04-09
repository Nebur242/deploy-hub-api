import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { FirebaseModule } from '../firebase.module';
import { FirebaseService } from '../firebase.service';

describe('FirebaseModule', () => {
  let firebaseModule: FirebaseModule;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FirebaseModule,
        ConfigModule.forRoot({
          isGlobal: true,
          // Mock environment variables if needed
          load: [
            () => ({
              FIREBASE_REST_API_KEY: 'mock-api-key',
            }),
          ],
        }),
      ],
    }).compile();

    firebaseModule = moduleRef.get<FirebaseModule>(FirebaseModule);
  });

  it('should be defined', () => {
    expect(firebaseModule).toBeDefined();
  });

  it('should provide FirebaseService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FirebaseModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ FIREBASE_REST_API_KEY: 'mock-api-key' })],
        }),
      ],
    }).compile();

    const firebaseService = moduleRef.get<FirebaseService>(FirebaseService);
    expect(firebaseService).toBeDefined();
  });

  it('should import HttpModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FirebaseModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ FIREBASE_REST_API_KEY: 'mock-api-key' })],
        }),
      ],
    }).compile();

    // Indirectly verify HttpModule is imported by checking if HttpService is available
    const firebaseService = moduleRef.get<FirebaseService>(FirebaseService);
    expect(firebaseService).toBeDefined();

    // This would throw an error if HttpModule wasn't properly imported
    expect(() => moduleRef.get(HttpModule, { strict: false })).not.toThrow();
  });
});
