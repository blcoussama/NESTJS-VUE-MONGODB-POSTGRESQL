import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExperienceLevel, JobType, SalaryType } from '../job.enums';

// Response shapes — used for the OpenAPI documentation only

export class CompanySummary {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ALTEN Maroc' }) name: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl: string | null;
}

export class SalaryView {
  @ApiPropertyOptional({ example: 8000 }) min?: number;
  @ApiPropertyOptional({ example: 12000 }) max?: number;
  @ApiPropertyOptional({ example: 'MAD' }) currency?: string;
}

export class JobResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Backend Developer (NestJS)' }) title: string;
  @ApiProperty() description: string;
  @ApiProperty({ example: 'Tanger, Maroc' }) location: string;
  @ApiProperty({ enum: JobType }) jobType: JobType;
  @ApiProperty({ enum: ExperienceLevel }) experienceLevel: ExperienceLevel;
  @ApiProperty({ type: [String] }) requirements: string[];
  @ApiProperty({ enum: SalaryType }) salaryType: SalaryType;
  @ApiProperty({ type: SalaryView, nullable: true }) salary: SalaryView | null;
  @ApiProperty() isOpen: boolean;
  @ApiProperty({ format: 'uuid' }) companyId: string;
  @ApiProperty({ example: '6710f0c2a1b2c3d4e5f60718' }) recruiterId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: CompanySummary }) company: CompanySummary;
}

export class JobDetailResponse extends JobResponse {
  @ApiPropertyOptional({ description: 'Only for a logged-in candidate' })
  isSaved?: boolean;
  @ApiPropertyOptional({ description: 'Only for a logged-in candidate' })
  hasApplied?: boolean;
  @ApiPropertyOptional({
    description: 'Only for a logged-in candidate',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
    nullable: true,
  })
  applicationStatus?: string | null;
}

export class MyJobResponse extends JobResponse {
  @ApiProperty({ description: 'Applications not withdrawn', example: 3 })
  applicationsCount: number;
}

export class PaginatedJobsResponse {
  @ApiProperty({ type: [JobResponse] }) items: JobResponse[];
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) limit: number;
  @ApiProperty({ example: 5 }) totalPages: number;
}
