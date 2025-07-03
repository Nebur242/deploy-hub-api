import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(FirebaseHealthIndicator.name);

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Attempt to list users (limit 1) to verify Firebase Admin SDK connection
      await getAuth().listUsers(1);

      return this.getStatus(key, true);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Firebase health check failed: ${error.message}`, error.stack);
      const result = this.getStatus(key, false, { message: 'Firebase connection failed' });
      throw new HealthCheckError('Firebase health check failed', result);
    }
  }
}
