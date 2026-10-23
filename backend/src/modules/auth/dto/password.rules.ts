import { applyDecorators } from '@nestjs/common';
import { IsByteLength, IsString, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently ignores everything after 72 bytes: refuse longer input. */
export const PASSWORD_MAX_BYTES = 72;

/** Password policy shared by signup and reset-password. */
export function IsStrongEnoughPassword() {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    IsByteLength(0, PASSWORD_MAX_BYTES, {
      message: `$property must be at most ${PASSWORD_MAX_BYTES} bytes long`,
    }),
  );
}
