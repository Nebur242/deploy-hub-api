import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UserNotification } from './entities/user-notification.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { User } from './entities/user.entity';
import { UserController } from './users.controller';
import { UsersService } from './users.service';
import { Order } from '../payment/entities';
import { Project } from '../projects/entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreferences, UserNotification, Order, Project]),
    NotificationsModule,
    SubscriptionsModule,
  ],
  controllers: [UserController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UserModule {}
