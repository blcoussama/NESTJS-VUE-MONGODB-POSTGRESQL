import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const MAX_SALARY = 100_000_000;

export class SalaryDto {
  @ApiPropertyOptional({ example: 8000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  min?: number;

  @ApiPropertyOptional({ example: 12000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  max?: number;

  @ApiPropertyOptional({ example: 'MAD', description: 'ISO 4217 code' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;
}
