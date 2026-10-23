import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT } from '../chat.constants';

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    description:
      'Id of the oldest message already loaded (`nextCursor` of the previous page)',
    example: '665f1c2e9b1e8a3d4c5b6a71',
  })
  @IsOptional()
  @IsMongoId()
  cursor?: string;

  @ApiPropertyOptional({
    default: HISTORY_DEFAULT_LIMIT,
    minimum: 1,
    maximum: HISTORY_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORY_MAX_LIMIT)
  limit?: number;
}
