import { TransformInterceptor } from '@core/interceptors/transform.interceptor';
import {
  BadRequestException,
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

import { AppModule } from './app.module';
import * as packages from '../package.json';
import { EnvironmentVariables } from './config/env.validation';
import { TypeOrmErrorsFilter } from './core/filters/typeorm-errors.filter';
import { SentryInterceptor } from './core/interceptors/sentry.interceptor';

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
        exceptionFactory(err) {
          const errors = err.reduce((acc: string[], e) => {
            if (e.constraints) {
              Object.values(e.constraints).forEach(constraint => acc.push(constraint));
            }
            if (e.children && e.children.length > 0) {
              e.children.forEach(child => {
                if (child.constraints) {
                  Object.values(child.constraints).forEach(constraint => acc.push(constraint));
                }
              });
            }
            return acc;
          }, []);
          return new BadRequestException({
            statusCode: 400,
            message: `Validation failed: ${errors.join(', ') || 'Invalid data'}`,
            error: 'Bad Request',
          });
        },
      }),
    )
    .useGlobalInterceptors(
      new TransformInterceptor(),
      new SentryInterceptor(configService.get('NODE_ENV')),
    )
    .useGlobalFilters(new TypeOrmErrorsFilter())
    .setGlobalPrefix(globalPrefix)
    .enableVersioning({
      type: VersioningType.URI,
      defaultVersion,
    })
    .enableCors();
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
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<EnvironmentVariables, true> = app.get(ConfigService);

  app.setGlobalPrefix(globalPrefix);
  setupSwagger(app);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  setupGlobalMiddlewares(app);

  const port = configService.get<string>('PORT') || 3000;

  initializeServices(app);

  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}/v${defaultVersion}`,
  );
}

bootstrap().catch(error => {
  Logger.error('Error during bootstrap', error);
  process.exit(1);
});
