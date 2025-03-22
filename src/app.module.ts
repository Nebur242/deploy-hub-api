import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvironmentVariables, validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        database: configService.get<string>('DB_NAME'),
        logging: configService.get<string>('DB_LOGGING') === 'true',
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        synchronize: configService.get('DB_SYNC') === 'true',
        type: 'postgres',
        cache: true,
        autoLoadEntities: true,
        entities: ['*.entity.ts'],
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
