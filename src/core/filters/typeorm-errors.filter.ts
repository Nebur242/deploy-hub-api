import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class TypeOrmErrorsFilter implements ExceptionFilter {
  private readonly logger: Logger = new Logger('TypeOrmErrorsFilter');

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const message = exception.message || 'Something Went Wrong';

    const statusCode = HttpStatus.BAD_REQUEST;

    const error = exception.driverError.message;

    this.logger.error(`${message} - ${error} - ${statusCode}`, exception.stack);

    response.status(statusCode).json({
      statusCode,
      message,
      error,
    });
  }
}
