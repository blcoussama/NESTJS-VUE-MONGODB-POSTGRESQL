import { IsHexadecimal, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Token received by email (64 hex characters)',
    example: '9f2c…',
  })
  @IsHexadecimal()
  @Length(64, 64)
  token: string;
}
