import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { DatabaseHealthIndicator } from './database.health';
import { FirebaseHealthIndicator } from './firebase.health';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { FirebaseModule } from '../firebase/firebase.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TerminusModule, QueueModule, FirebaseModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, DatabaseHealthIndicator, FirebaseHealthIndicator],
})
export class HealthModule {}
