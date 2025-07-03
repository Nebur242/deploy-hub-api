import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    return this.typeOrmHealthIndicator.pingCheck(key);
  }
}
