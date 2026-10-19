import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ExperienceLevel, JobType, SalaryType } from '../job.enums';
import { SalaryDto } from './salary.dto';

export class CreateJobDto {
  @ApiProperty({ example: 'Backend Developer (NestJS)', maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiProperty({
    example: 'You will build REST APIs with NestJS, PostgreSQL and MongoDB.',
    maxLength: 10000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description: string;

  @ApiProperty({ example: 'Tanger, Maroc', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location: string;

  @ApiProperty({ enum: JobType, example: JobType.FULL_TIME })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty({ enum: ExperienceLevel, example: ExperienceLevel.JUNIOR })
  @IsEnum(ExperienceLevel)
  experienceLevel: ExperienceLevel;

  @ApiProperty({
    type: [String],
    example: ['TypeScript', 'NestJS', 'PostgreSQL'],
    maxItems: 30,
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  requirements: string[];

  @ApiProperty({
    enum: SalaryType,
    example: SalaryType.RANGE,
    description:
      'range → salary.min and salary.max required (min ≤ max); fixed → salary.min required; negotiable → no amount',
  })
  @IsEnum(SalaryType)
  salaryType: SalaryType;

  @ApiPropertyOptional({ type: SalaryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryDto)
  salary?: SalaryDto;

  @ApiProperty({
    format: 'uuid',
    description: 'Company owned by the current recruiter',
  })
  @IsUUID()
  companyId: string;
}
