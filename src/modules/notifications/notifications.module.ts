import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsController } from './controllers/notifications.controller';
import { TokensController } from './controllers/tokens.controller';
import { NotificationEntity } from './entities/notification.enty';
import { UserTokenEntity } from './entities/user-token.entity';
import { NotificationProcessor } from './processors/notification.processor';
import { EmailService } from './providers/email.service';
import { FirebasePushService } from './providers/firebase-push.service';
import { SmsService } from './providers/sms.service';
import { NotificationRepository } from './repositories/notification.repository';
import { UserTokenRepository } from './repositories/user-token.repository';
import { NotificationEventListenerService } from './services/notification-event-listener.service';
import { NotificationService } from './services/notification.service';
import { TokensService } from './services/tokens.service';
import { NOTIFICATION_QUEUE } from '../queue/constants/notification-queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, UserTokenEntity]),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [NotificationsController, TokensController],
  providers: [
    NotificationRepository,
    UserTokenRepository,
    NotificationService,
    TokensService,
    NotificationProcessor,
    EmailService,
    SmsService,
    FirebasePushService,
    NotificationEventListenerService,
  ],
  exports: [NotificationService, TokensService],
})
export class NotificationsModule {}
