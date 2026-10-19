import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsHttpUrl } from '../../../common/validation/is-http-url.decorator';

export class ExperienceDto {
  @ApiProperty({ example: 'Full-Stack Developer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: 'ALTEN Maroc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @ApiPropertyOptional({
    example: 'Developed REST APIs with NestJS and React.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class EducationDto {
  @ApiProperty({ example: 'EMSI Tanger' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  school: string;

  @ApiProperty({ example: 'Ingénieur Informatique' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  degree: string;

  @ApiPropertyOptional({ example: 'Développement Informatique' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  field?: string;

  @ApiProperty({ example: '2022-09-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

/**
 * Fields a CANDIDATE may change on PATCH /users/me. Anything else (role,
 * email, password, cvKey, avatarUrl, tokens…) is rejected with 400.
 */
export class UpdateCandidateProfileDto {
  @ApiPropertyOptional({ example: 'Oussama', maxLength: 50 })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Belcadi', maxLength: 50 })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Full-Stack Developer | NestJS & React' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  headline?: string;

  @ApiPropertyOptional({
    example: 'Passionate about building scalable web apps.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'Tanger, Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: '+212 600 000 000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/oussama-belcadi' })
  @IsOptional()
  @IsHttpUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/blcoussama' })
  @IsOptional()
  @IsHttpUrl()
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://oussama.dev' })
  @IsOptional()
  @IsHttpUrl()
  portfolioUrl?: string;

  @ApiPropertyOptional({
    example: ['NestJS', 'React', 'TypeScript', 'MongoDB'],
    maxItems: 50,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: true })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ type: [ExperienceDto], maxItems: 30 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[];

  @ApiPropertyOptional({ type: [EducationDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education?: EducationDto[];
}

/** Explicit allow-list copied to the user document (never Object.assign). */
export const CANDIDATE_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'headline',
  'bio',
  'location',
  'phone',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'skills',
  'isAvailable',
  'experiences',
  'education',
] as const satisfies readonly (keyof UpdateCandidateProfileDto)[];
