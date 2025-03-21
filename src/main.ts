import {
  BadRequestException,
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';

const defaultVersion = 1;
const globalPrefix = 'api';

function setupGlobalMiddlewares(app: INestApplication) {
  return (
    app
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
      .useGlobalInterceptors(new TransformInterceptor())
      // .useGlobalFilters(new BaseRpcExceptionFilter())
      .setGlobalPrefix(globalPrefix)
      .enableVersioning({
        type: VersioningType.URI,
        defaultVersion: `${defaultVersion}`,
      })
      .enableCors()
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const port = process.env.PORT || 3000;
  setupGlobalMiddlewares(app);
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}/v${defaultVersion}`,
  );
}

bootstrap().catch(error => {
  Logger.error('Error during bootstrap', error);
});
