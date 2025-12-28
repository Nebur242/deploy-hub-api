import { INestApplication, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

import { AppModule } from './app.module';
import * as packages from '../package.json';
import { EnvironmentVariables } from './config/env.validation';
import { TypeOrmErrorsFilter } from './core/filters/typeorm-errors.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { SentryInterceptor } from './core/interceptors/sentry.interceptor';
import { RedisHealthService } from './modules/queue/redis-health.service';

const defaultVersion = '1';
const globalPrefix = 'api';

function setupSwagger(app: INestApplication): INestApplication {
  const config = new DocumentBuilder()
    .setTitle('DeployHub API')
    .setDescription('The DeployHub API documentation')
    .setVersion(packages.version)
    .addBearerAuth({ type: 'http' })
    .addTag('DeployHub')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  return app;
}

function setupGlobalMiddlewares(app: INestApplication) {
  const configService: ConfigService<EnvironmentVariables, true> = app.get(ConfigService);

  return app
    .useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    .useGlobalInterceptors(
      new SentryInterceptor(configService.get('NODE_ENV')),
      new LoggingInterceptor(configService.get('NODE_ENV')),
    )
    .useGlobalFilters(new TypeOrmErrorsFilter())
    .setGlobalPrefix(globalPrefix)
    .enableVersioning({
      type: VersioningType.URI,
      defaultVersion,
    })
    .enableCors();
}

// Check Redis health explicitly
async function checkRedisHealth(app: INestApplication): Promise<boolean> {
  const logger = new Logger('Bootstrap');
  logger.log('🔍 Checking Redis health...');

  try {
    const redisHealthService = app.get(RedisHealthService);
    const isHealthy = await redisHealthService.isHealthy();

    if (isHealthy) {
      logger.log('✅ Redis health check passed');
      return true;
    } else {
      logger.error('❌ Redis health check failed - Redis is not responding properly');
      return false;
    }
  } catch (err) {
    const error = err as Error;
    logger.error(`❌ Redis health check failed with error: ${error.message}`, error.stack);
    return false;
  }
}

// Check Firebase health explicitly
async function checkFirebaseHealth(): Promise<boolean> {
  const logger = new Logger('Bootstrap');
  logger.log('🔍 Checking Firebase connection...');

  try {
    const auth = getAuth();
    await auth.listUsers(1); // Try to list a single user to verify connection

    logger.log('✅ Firebase health check passed');
    return true;
  } catch (err) {
    const error = err as Error;
    logger.error(`❌ Firebase health check failed with error: ${error.message}`, error.stack);
    return false;
  }
}

const initializeServices = (app: INestApplication) => {
  const configService: ConfigService<EnvironmentVariables, true> = app.get(ConfigService);

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
        privateKey: configService.get<string>('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      }),
    });
  }

  Sentry.init({
    dsn: configService.get<string>('SENTRY_DSN'),
    profileSessionSampleRate: 1.0,
  });
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('🚀 Starting application...');

  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<EnvironmentVariables, true> = app.get(ConfigService);

  app.setGlobalPrefix(globalPrefix);
  setupSwagger(app);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  setupGlobalMiddlewares(app);

  // Initialize services (Firebase, Sentry)
  initializeServices(app);

  // Create logs directory if it doesn't exist
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }

  // Explicit Redis health check during bootstrap
  const redisHealthy = await checkRedisHealth(app);
  if (!redisHealthy) {
    logger.warn(
      '⚠️ Application starting with Redis in an unhealthy state. Queue functionality may be affected.',
    );
    // Uncomment the line below if you want to prevent the application from starting when Redis is not healthy
    // throw new Error('Redis health check failed during bootstrap. Application startup aborted.');
  }

  // Explicit Firebase health check during bootstrap
  const firebaseHealthy = await checkFirebaseHealth();
  if (!firebaseHealthy) {
    logger.warn(
      '⚠️ Application starting with Firebase in an unhealthy state. Authentication functionality may be affected.',
    );
    // Uncomment the line below if you want to prevent the application from starting when Firebase is not healthy
    // throw new Error('Firebase health check failed during bootstrap. Application startup aborted.');
  }

  if (!firebaseHealthy || !redisHealthy) {
    logger.error('❌ Application startup aborted due to Firebase health check failure.');
    await app.close();
    return;
  }

  const port = configService.get<string>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(
    `🚀 Application is running on: http://0.0.0.0:${port}/${globalPrefix}/v${defaultVersion}`,
  );
}

bootstrap().catch(error => {
  Logger.error('Error during bootstrap', error);
  process.exit(1);
});
