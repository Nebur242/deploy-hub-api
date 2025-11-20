import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RESPONSE_MESSAGE_KEY, ResponseMetadata } from '../decorators/response-message.decorator';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
  path: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const METHOD_MESSAGES: Record<Method, string> = {
  GET: 'Data retrieved successfully',
  POST: 'Resource created successfully',
  PUT: 'Resource updated successfully',
  PATCH: 'Resource updated successfully',
  DELETE: 'Resource deleted successfully',
};

const DEFAULT_MESSAGE = 'Operation completed successfully';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response & { statusCode: number }>();
    const request = context.switchToHttp().getRequest<Request & { method: Method }>();

    // Get metadata from decorator
    const responseMetadata = this.reflector.get<ResponseMetadata>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    const statusCode = response.statusCode;
    const method = request.method;
    const path = request.url;

    // Determine the message priority:
    // 1. Custom message from decorator
    // 2. Method-based message
    // 3. Default message
    const message = responseMetadata?.message || METHOD_MESSAGES[method] || DEFAULT_MESSAGE;

    return next.handle().pipe(
      map<T, ApiResponse<T>>(data => ({
        success: statusCode >= 200 && statusCode < 300,
        statusCode: responseMetadata?.successCode || statusCode,
        message,
        data,
        meta: responseMetadata?.meta,
        timestamp: new Date().toISOString(),
        path,
      })),
    );
  }
}
