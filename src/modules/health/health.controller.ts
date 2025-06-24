import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { DatabaseHealthIndicator } from './database.health';
import { FirebaseHealthIndicator } from './firebase.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly firebaseHealthIndicator: FirebaseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redisHealthIndicator.isHealthy('redis'),
      () => this.databaseHealthIndicator.isHealthy('database'),
      () => this.firebaseHealthIndicator.isHealthy('firebase'),
    ]);
  }

  @Get('redis')
  @HealthCheck()
  checkRedis() {
    return this.health.check([() => this.redisHealthIndicator.isHealthy('redis')]);
  }

  @Get('database')
  @HealthCheck()
  checkDatabase() {
    return this.health.check([() => this.databaseHealthIndicator.isHealthy('database')]);
  }

  @Get('firebase')
  @HealthCheck()
  checkFirebase() {
    return this.health.check([() => this.firebaseHealthIndicator.isHealthy('firebase')]);
  }
}
