import { Environment } from '@app/shared/enums';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly NODE_ENV: `${Environment}`) {}

  private readonly logger = new Logger(LoggingInterceptor.name);

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<
      Request & {
        query: Record<string, string>;
        ip: string;
        headers: Record<string, string>;
      }
    >();
    const response = context.switchToHttp().getResponse<Response & { statusCode: number }>();
    const { method, url, body, query, headers, ip } = request;
    const start = Date.now();
    const requestId = uuidv4().substring(0, 8); // Short UUID for readability
    const timestamp = this.formatDateTime(new Date());

    // Build request info string
    const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    const queryStr = query && Object.keys(query).length > 0 ? JSON.stringify(query) : '';
    const userAgent = headers['user-agent'] || '';
    const auth = headers.authorization ? 'Bearer ***' : '';

    const requestInfo = [
      `${method} ${url}`,
      timestamp,
      `IP: ${ip}`,
      userAgent ? `UA: ${userAgent}` : '',
      auth ? `Auth: ${auth}` : '',
      bodyStr ? `Body: ${bodyStr}` : '',
      queryStr ? `Query: ${queryStr}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    this.logger.debug(`📥 [Req for id: ${requestId}] | ${requestInfo}`);

    return next.handle().pipe(
      tap(responseData => {
        const duration = Date.now() - start;
        const responseTimestamp = this.formatDateTime(new Date());

        let log = `📤 [Res for id: ${requestId}] | ${method} ${url} | ${responseTimestamp} | statusCode: ${response.statusCode} | duration: ${duration}ms`;

        if (this.NODE_ENV === 'development') {
          let responseStr = '';
          try {
            responseStr = JSON.stringify(responseData);
            log = log + ` | Response: ${responseStr}`;
          } catch {
            log = log + ` | Response: [Circular or non-serializable data]`;
          }
        }

        // Safely stringify response data

        this.logger.debug(log);
      }),
    );
  }
}
