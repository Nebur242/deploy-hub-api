import { EnvironmentVariables } from '@app/config/env.validation';
import { ExecutionContext, Injectable, NestInterceptor, CallHandler } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly configService?: ConfigService<EnvironmentVariables, true>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap({
        error: exception => {
          if (this.configService?.get('NODE_ENV') !== 'local') {
            return console.error('Sentry error:', exception);
          }
          Sentry.captureException(exception);
        },
      }),
    );
  }
}
