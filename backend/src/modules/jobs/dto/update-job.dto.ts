import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ExperienceLevel, JobType, SalaryType } from '../job.enums';
import { SalaryDto } from './salary.dto';

/** `undefined` = unchanged; `null` is rejected (except for salary). */
const IfPresent = () => ValidateIf((_dto, value) => value !== undefined);

/**
 * Partial update of a job. `companyId` and `recruiterId` cannot be changed:
 * sending them is rejected (whitelist + forbidNonWhitelisted).
 */
export class UpdateJobDto {
  @ApiPropertyOptional({ example: 'Senior Backend Developer', maxLength: 120 })
  @IfPresent()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IfPresent()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc', maxLength: 100 })
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ enum: JobType })
  @IfPresent()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional({ enum: ExperienceLevel })
  @IfPresent()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IfPresent()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  requirements?: string[];

  @ApiPropertyOptional({ enum: SalaryType })
  @IfPresent()
  @IsEnum(SalaryType)
  salaryType?: SalaryType;

  @ApiPropertyOptional({
    type: SalaryDto,
    nullable: true,
    description: 'null clears the salary',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryDto)
  salary?: SalaryDto | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Close / reopen the job',
  })
  @IfPresent()
  @IsBoolean()
  isOpen?: boolean;
}
