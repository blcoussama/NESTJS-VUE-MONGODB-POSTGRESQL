import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/validation/normalize-email.transform';

export class ResendVerificationDto {
  @ApiProperty({ example: 'oussama@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;
}
