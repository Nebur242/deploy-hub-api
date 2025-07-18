import { ExecutionContext, Injectable, NestInterceptor, CallHandler } from '@nestjs/common';
import * as Sentry from '@sentry/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly nodeEnv: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap({
        error: exception => {
          if (this.nodeEnv === 'local') {
            return console.error('Sentry error:', exception);
          }
          Sentry.captureException(exception);
        },
      }),
    );
  }
}
