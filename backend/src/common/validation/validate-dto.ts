import { BadRequestException } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/** Same options as the global ValidationPipe (see app.setup.ts). */
const STRICT_VALIDATION = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};

function flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    // Same format as ValidationPipe: "experiences.0.title should not be empty"
    const own = Object.values(error.constraints ?? {}).map((message) =>
      parentPath ? `${parentPath}.${message}` : message,
    );
    return [...own, ...flattenErrors(error.children ?? [], path)];
  });
}

/**
 * Validates an untyped payload against a DTO class with the same strictness
 * as the global ValidationPipe. Needed when the DTO depends on runtime data
 * (e.g. the user's role) — TypeScript union types are emitted as `Object`,
 * which the ValidationPipe silently skips.
 */
export async function validateDto<T extends object>(
  dtoClass: ClassConstructor<T>,
  payload: unknown,
): Promise<T> {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new BadRequestException('Request body must be a JSON object');
  }

  const instance = plainToInstance(dtoClass, payload);
  const errors = await validate(instance, STRICT_VALIDATION);
  if (errors.length > 0) {
    throw new BadRequestException(flattenErrors(errors));
  }
  return instance;
}
