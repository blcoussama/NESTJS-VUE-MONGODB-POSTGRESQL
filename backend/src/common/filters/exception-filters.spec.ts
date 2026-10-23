import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import mongoose from 'mongoose';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { MongoExceptionFilter } from './mongo-exception.filter';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

function httpHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.company.create()` invocation: table "companies"…',
    { code, clientVersion: 'test' },
  );
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it.each([
    ['P2002', 409, 'Conflict'],
    ['P2025', 404, 'Not Found'],
    ['P2003', 409, 'Conflict'],
    ['P2023', 400, 'Bad Request'],
    ['P1001', 500, 'Internal Server Error'],
  ])('maps %s to HTTP %i', (code, statusCode, error) => {
    const { host, status, json } = httpHost();

    filter.catch(prismaError(code), host);

    expect(status).toHaveBeenCalledWith(statusCode);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode, error }),
    );
  });

  it('never leaks the raw Prisma message (table/column names)', () => {
    const { host, json } = httpHost();

    filter.catch(prismaError('P2002'), host);

    const body = arg(json, 0, 0) as { message: string };
    expect(body.message).not.toMatch(/prisma|companies/i);
  });
});

describe('MongoExceptionFilter', () => {
  const filter = new MongoExceptionFilter();

  it('maps a duplicate key (11000) to 409', () => {
    const { host, status } = httpHost();
    const error = new mongoose.mongo.MongoServerError({
      message: 'E11000 duplicate key error collection: users',
      code: 11000,
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
  });

  it('maps a CastError (invalid ObjectId) to 400', () => {
    const { host, status } = httpHost();
    const error = new mongoose.Error.CastError('ObjectId', 'nope', '_id');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps other server errors to 500', () => {
    const { host, status } = httpHost();
    const error = new mongoose.mongo.MongoServerError({
      message: 'boom',
      code: 2,
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
