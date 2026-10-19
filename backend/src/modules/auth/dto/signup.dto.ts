import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/schemas/user.schema';
import { NormalizeEmail } from '../../../common/validation/normalize-email.transform';
import {
  IsStrongEnoughPassword,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from './password.rules';

export class SignupDto {
  @ApiProperty({ example: 'Oussama', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Belcadi', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'oussama@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'StrongPass123!',
    minLength: PASSWORD_MIN_LENGTH,
    description: `${PASSWORD_MIN_LENGTH} characters minimum, ${PASSWORD_MAX_BYTES} bytes maximum`,
  })
  @IsStrongEnoughPassword()
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CANDIDATE })
  @IsEnum(UserRole)
  role: UserRole;
}
