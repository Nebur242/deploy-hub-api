import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorObject {
  code: string;
  message: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  errors: ErrorObject[];
  timestamp: string;
  path: string;
  success: boolean;
}

interface ExceptionResponseObject {
  message?: string;
  error?: string;
  statusCode?: number;
  errors?: ErrorObject[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log the error for debugging
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private hasArrayMessage(obj: object): obj is { message: string[] } {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'message' in obj &&
      Array.isArray((obj as Record<string, unknown>).message)
    );
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: ErrorObject[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errors = [{ code: 'ERROR_DETAILS', message: exceptionResponse }];
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponseObject;

        // Handle our custom exception format with errors array
        if (responseObj.errors && Array.isArray(responseObj.errors)) {
          message = responseObj.message || 'Error occurred';
          errors = responseObj.errors;
        }
        // Handle validation errors (from class-validator) - check the raw response
        else if (this.hasArrayMessage(exceptionResponse)) {
          message = 'Validation failed';
          const validationMessages = exceptionResponse.message;
          errors = validationMessages.map((msg, index) => ({
            code: `VALIDATION_ERROR_${index + 1}`,
            message: String(msg),
          }));
        } else if (responseObj.message) {
          message = responseObj.message;
          errors = [{ code: 'ERROR_DETAILS', message: responseObj.message }];
        } else {
          message = responseObj.error || 'Bad request';
          errors = [{ code: 'ERROR_DETAILS', message }];
        }
      }
    } else if (exception instanceof Error) {
      // Handle other types of errors
      message = exception.message || 'Internal server error';
      errors = [{ code: 'ERROR_DETAILS', message }];

      // You can add specific error type handling here
      if (exception.name === 'ValidationError') {
        statusCode = HttpStatus.BAD_REQUEST;
      }
    } else {
      // Handle unknown exception types
      message = 'Unknown error occurred';
      errors = [{ code: 'ERROR_UNKNOWN', message }];
    }

    return {
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      success: false,
    };
  }
}
