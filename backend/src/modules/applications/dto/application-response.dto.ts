import { ApiProperty } from '@nestjs/swagger';
import { ExperienceLevel, JobType } from '../../jobs/job.enums';
import { CompanySummary } from '../../jobs/dto/job-response.dto';

// Response shapes — used for the OpenAPI documentation only

const STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];

export class ApplicationResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) jobId: string;
  @ApiProperty({ example: '6710f0c2a1b2c3d4e5f60718' }) applicantId: string;
  @ApiProperty({ example: 2 }) experienceYears: number;
  @ApiProperty({ enum: ExperienceLevel }) experienceLevel: ExperienceLevel;
  @ApiProperty({ enum: STATUSES }) status: string;
  @ApiProperty({ nullable: true, type: Date }) withdrawnAt: Date | null;
  @ApiProperty({
    nullable: true,
    type: Date,
    description: 'Purge date of a withdrawn application',
  })
  expiresAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ApplicationJobSummary {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty() location: string;
  @ApiProperty({ enum: JobType }) jobType: JobType;
  @ApiProperty() isOpen: boolean;
  @ApiProperty({ description: 'MongoDB id of the recruiter (for the chat)' })
  recruiterId: string;
  @ApiProperty({ type: CompanySummary }) company: CompanySummary;
}

export class MyApplicationResponse extends ApplicationResponse {
  @ApiProperty({ type: ApplicationJobSummary }) job: ApplicationJobSummary;
}

export class ApplicantSummaryResponse {
  @ApiProperty({ example: '6710f0c2a1b2c3d4e5f60718' }) id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true, type: String }) avatarUrl: string | null;
  @ApiProperty({ description: 'Whether a CV can be downloaded (cv-url)' })
  hasCv: boolean;
}

export class JobApplicationResponse extends ApplicationResponse {
  @ApiProperty({ type: ApplicantSummaryResponse, nullable: true })
  applicant: ApplicantSummaryResponse | null;
}
