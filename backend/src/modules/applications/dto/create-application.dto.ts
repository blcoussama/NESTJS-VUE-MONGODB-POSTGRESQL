import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { ExperienceLevel } from '../../jobs/job.enums';

export class CreateApplicationDto {
  @ApiProperty({ example: 2, minimum: 0, maximum: 60 })
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears: number;

  @ApiProperty({ enum: ExperienceLevel, example: ExperienceLevel.JUNIOR })
  @IsEnum(ExperienceLevel)
  experienceLevel: ExperienceLevel;
}
