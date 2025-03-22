import { TransformInterceptor } from '@core/interceptors/transform.interceptor';
import {
  BadRequestException,
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';

import { AppModule } from './app.module';
import * as packages from '../package.json';
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
  return app
    .useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory(errors) {
          return new BadRequestException({
            statusCode: 400,
            message: 'Bad Request',
            errors: errors.reduce(
              (acc, e) => [...acc, ...(e.constraints ? Object.values(e.constraints) : [])],
              [],
            ),
          });
        },
      }),
    )
    .useGlobalInterceptors(new TransformInterceptor(), new SentryInterceptor())
    .setGlobalPrefix(globalPrefix)
    .enableVersioning({
      type: VersioningType.URI,
      defaultVersion,
    })
    .enableCors();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(globalPrefix);
  setupSwagger(app);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const port = process.env.PORT || 3000;

  setupGlobalMiddlewares(app);

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    profileSessionSampleRate: 1.0,
  });

  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}/v${defaultVersion}`,
  );
}

bootstrap().catch(error => {
  Logger.error('Error during bootstrap', error);
  process.exit(1);
});
