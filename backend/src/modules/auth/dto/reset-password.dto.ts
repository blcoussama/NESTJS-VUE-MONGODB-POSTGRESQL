import { IsHexadecimal, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsStrongEnoughPassword,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from './password.rules';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received by email (64 hex characters)' })
  @IsHexadecimal()
  @Length(64, 64)
  token: string;

  @ApiProperty({
    example: 'NewStrongPass123!',
    minLength: PASSWORD_MIN_LENGTH,
    description: `${PASSWORD_MIN_LENGTH} characters minimum, ${PASSWORD_MAX_BYTES} bytes maximum`,
  })
  @IsStrongEnoughPassword()
  newPassword: string;
}
