import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import mongoose from 'mongoose';

type MongoError =
  | mongoose.mongo.MongoServerError
  | mongoose.Error.CastError
  | mongoose.Error.ValidationError;

/**
 * Maps Mongo/Mongoose errors to HTTP errors: duplicate key → 409,
 * cast/validation errors → 400. Raw driver messages are never returned.
 */
@Catch(
  mongoose.mongo.MongoServerError,
  mongoose.Error.CastError,
  mongoose.Error.ValidationError,
)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongoExceptionFilter.name);

  catch(exception: MongoError, host: ArgumentsHost) {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'Internal server error';

    if (exception instanceof mongoose.Error.CastError) {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Invalid identifier or value.';
    } else if (exception instanceof mongoose.Error.ValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Validation failed.';
    } else if (exception.code === 11000) {
      statusCode = HttpStatus.CONFLICT;
      error = 'Conflict';
      message = 'A resource with the same unique value already exists.';
    } else {
      this.logger.error(`Unhandled MongoDB error ${String(exception.code)}`);
    }

    if (host.getType() !== 'http') return;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, message, error });
  }
}
