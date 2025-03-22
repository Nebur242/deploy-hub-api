import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const METHOD_MESSAGES: Record<Method, string> = {
  GET: 'Resource found',
  POST: 'Resource created',
  PUT: 'Resource updated',
  PATCH: 'Resource updated',
  DELETE: 'Resource deleted',
};

const DEFAULT_MESSAGE = 'Success';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const request = context.switchToHttp().getRequest<{ method: Method }>();

    const statusCode = response.statusCode;
    const method = request.method;
    const message = method in METHOD_MESSAGES ? METHOD_MESSAGES[method] : DEFAULT_MESSAGE;

    return next.handle().pipe(
      map<
        T,
        {
          statusCode: number;
          message: string;
          data: T;
        }
      >(data => ({
        statusCode,
        message,
        data,
      })),
    );
  }
}
