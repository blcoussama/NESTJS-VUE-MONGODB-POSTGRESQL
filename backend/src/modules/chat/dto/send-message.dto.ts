import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MESSAGE_MAX_LENGTH } from '../chat.constants';

export class SendMessageDto {
  @ApiProperty({
    example: '665f1c2e9b1e8a3d4c5b6a71',
    description: 'Recipient user id (MongoDB ObjectId)',
  })
  @IsMongoId()
  to: string;

  @ApiProperty({
    example: 'Hello, thank you for your application!',
    maxLength: MESSAGE_MAX_LENGTH,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MESSAGE_MAX_LENGTH)
  text: string;
}
