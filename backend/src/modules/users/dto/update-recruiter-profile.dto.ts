import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsHttpUrl } from '../../../common/validation/is-http-url.decorator';

/**
 * Fields a RECRUITER may change on PATCH /users/me. Candidate-only fields
 * (skills, experiences…) and sensitive fields are rejected with 400.
 */
export class UpdateRecruiterProfileDto {
  @ApiPropertyOptional({ example: 'Sara', maxLength: 50 })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'El Amrani', maxLength: 50 })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'HR Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  headline?: string;

  @ApiPropertyOptional({
    example: 'Experienced recruiter specializing in tech profiles.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: '+212 600 000 000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/recruiter' })
  @IsOptional()
  @IsHttpUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'ALTEN Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://alten.ma' })
  @IsOptional()
  @IsHttpUrl()
  companyWebsite?: string;
}

/** Explicit allow-list copied to the user document (never Object.assign). */
export const RECRUITER_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'headline',
  'bio',
  'location',
  'phone',
  'linkedinUrl',
  'companyName',
  'companyWebsite',
] as const satisfies readonly (keyof UpdateRecruiterProfileDto)[];
