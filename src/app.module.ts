import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvironmentVariables, validate } from './config/env.validation';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DeploymentModule } from './modules/deployments/deployment-module.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { HealthModule } from './modules/health/health.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TestHelpersModule } from './modules/test-helpers/test-helpers.module';
import { UserModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
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
      }),
    }),
    AuthModule,
    CategoriesModule,
    FirebaseModule,
    TestHelpersModule,
    UserModule,
    MediaModule,
    ProjectsModule,
    LicensesModule,
    PaymentModule,
    DeploymentModule,
    HealthModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
