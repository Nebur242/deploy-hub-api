import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvironmentVariables, validate } from './config/env.validation';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DeploymentModule } from './modules/deployments/deployment.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { HealthModule } from './modules/health/health.module';
import { LicenseModule } from './modules/license/license.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { SupportModule } from './modules/support/support.module';
import { TestHelpersModule } from './modules/test-helpers/test-helpers.module';
import { UserModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    EventEmitterModule.forRoot({
      // Use wildcard events for flexibility
      wildcard: true,
      // Set delimiter for nested event names
      delimiter: '.',
      // Enable new listener events
      newListener: false,
      // Remove listener events
      removeListener: false,
      // Maximum listeners per event
      maxListeners: 10,
      // Show memory leak warning when max listeners exceeded
      verboseMemoryLeak: true,
      // Ignore errors when emitting events
      ignoreErrors: false,
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        database: configService.get<string>('DB_NAME'),
        logging: configService.get<boolean>('DB_LOGGING'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        synchronize: configService.get<boolean>('DB_SYNC'),
        type: 'postgres',
        cache: true,
        autoLoadEntities: true,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Ensure timestamps are stored and retrieved in UTC
        extra: {
          timezone: 'UTC',
        },
      }),
    }),
    AuthModule,
    CategoriesModule,
    FirebaseModule,
    TestHelpersModule,
    UserModule,
    MediaModule,
    ProjectsModule,
    LicenseModule,
    OrderModule,
    PaymentModule,
    DeploymentModule,
    HealthModule,
    NotificationsModule,
    ReviewsModule,
    SubscriptionModule,
    StatisticsModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
