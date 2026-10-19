import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface MappedError {
  statusCode: HttpStatus;
  error: string;
  message: string;
}

/** Known Prisma error codes → HTTP. See https://pris.ly/d/error-reference */
export function mapPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): MappedError {
  switch (exception.code) {
    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'A resource with the same unique value already exists.',
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Resource not found.',
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Related resource constraint failed.',
      };
    case 'P2000':
    case 'P2006':
    case 'P2007':
    case 'P2023':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid value.',
      };
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Internal server error',
      };
  }
}

/**
 * Turns Prisma errors that escape the services (races on unique constraints,
 * deleted rows…) into proper HTTP errors instead of a generic 500.
 * Never leaks the raw Prisma message (it contains table/column names).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = mapPrismaError(exception);
    if (mapped.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled Prisma error ${exception.code}`);
    }

    if (host.getType() !== 'http') return;
    host.switchToHttp().getResponse<Response>().status(mapped.statusCode).json({
      statusCode: mapped.statusCode,
      message: mapped.message,
      error: mapped.error,
    });
  }
}
