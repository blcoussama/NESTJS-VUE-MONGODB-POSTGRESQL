import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export const RECRUITER_DECISIONS = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
] as const;

export type RecruiterDecision = (typeof RECRUITER_DECISIONS)[number];

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: RECRUITER_DECISIONS, example: 'ACCEPTED' })
  @IsIn(RECRUITER_DECISIONS)
  status: RecruiterDecision;
}
