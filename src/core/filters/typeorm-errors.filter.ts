import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface DatabaseError {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
}

interface ErrorResponse {
  code: string;
  message: string;
}

interface DatabaseErrorResponse {
  statusCode: HttpStatus;
  message: string;
  errors: ErrorResponse[];
}

@Catch(QueryFailedError)
export class TypeOrmErrorsFilter implements ExceptionFilter {
  private readonly logger: Logger = new Logger('TypeOrmErrorsFilter');

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.buildErrorResponse(exception);

    this.logger.error(
      `${request.method} ${request.url} - Database Error: ${exception.message}`,
      exception.stack,
    );

    response.status(statusCode).json({
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      success: false,
    });
  }

  private buildErrorResponse(exception: QueryFailedError): DatabaseErrorResponse {
    const driverError = exception.driverError as DatabaseError;
    const errorCode = driverError?.code ?? 'UNKNOWN_DB_ERROR';

    switch (errorCode) {
      case '23505': // Unique constraint violation
        return this.constraintViolationResponse(
          'Unique',
          driverError.detail ?? 'A record with this information already exists.',
        );

      case '23503': // Foreign key constraint violation
        return this.constraintViolationResponse(
          'Foreign key',
          driverError.detail ?? 'Referenced record does not exist.',
        );

      case '23502': // Not null constraint violation
        return this.validationErrorResponse('required field');

      case '22001': // String data too long
        return this.validationErrorResponse('data length');

      case '08001': // Connection error
      case '08006': // Connection failure
        return this.connectionErrorResponse();

      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Database operation failed',
          errors: [
            {
              code: 'DATABASE_QUERY_FAILED',
              message: exception.message || 'Database operation failed.',
            },
            {
              code: 'ERROR_DETAILS',
              message:
                driverError?.detail ?? driverError?.message ?? 'Unknown database error occurred.',
            },
          ],
        };
    }
  }

  private constraintViolationResponse(
    constraintType: string,
    details: string,
  ): DatabaseErrorResponse {
    const errors: ErrorResponse[] = [
      {
        code: 'DATABASE_CONSTRAINT_VIOLATION',
        message: `${constraintType} constraint violation occurred.`,
      },
      {
        code: 'ERROR_DETAILS',
        message: details,
      },
    ];

    return {
      statusCode: HttpStatus.CONFLICT,
      message: 'Database constraint violation',
      errors,
    };
  }

  private validationErrorResponse(fieldName: string): DatabaseErrorResponse {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: `Invalid value for field: ${fieldName}`,
      errors: [
        {
          code: 'VALIDATION_FAILED',
          message: `The value provided for '${fieldName}' is invalid.`,
        },
        {
          code: 'CHECK_CREDENTIALS',
          message: 'Please verify your input and try again.',
        },
      ],
    };
  }

  private connectionErrorResponse(): DatabaseErrorResponse {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Database service unavailable',
      errors: [
        {
          code: 'DATABASE_CONNECTION_FAILED',
          message: 'Unable to connect to the database.',
        },
        {
          code: 'TRY_AGAIN_LATER',
          message: 'Please try again in a few moments.',
        },
      ],
    };
  }
}
