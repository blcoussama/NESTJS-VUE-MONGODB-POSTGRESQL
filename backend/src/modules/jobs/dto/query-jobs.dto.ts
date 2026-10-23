import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExperienceLevel, JobSort, JobType } from '../job.enums';

export const JOBS_MAX_LIMIT = 50;

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class QueryJobsDto {
  @ApiPropertyOptional({
    description: 'Searched in title and description (case-insensitive)',
    example: 'nestjs',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'Tanger' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ enum: JobType })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional({ enum: ExperienceLevel })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: JOBS_MAX_LIMIT, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(JOBS_MAX_LIMIT)
  limit: number = 10;

  @ApiPropertyOptional({ enum: JobSort, default: JobSort.RECENT })
  @IsOptional()
  @IsEnum(JobSort)
  sort: JobSort = JobSort.RECENT;
}
