import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../users/schemas/user.schema';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import {
  ApplicationResponse,
  JobApplicationResponse,
  MyApplicationResponse,
} from './dto/application-response.dto';

const JOB_ID = { name: 'jobId', format: 'uuid', description: 'Job UUID' };
const APPLICATION_ID = {
  name: 'id',
  format: 'uuid',
  description: 'Application UUID',
};

@ApiTags('Applications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // ─── POST /jobs/:jobId/applications ───────────────────────────────────────

  @Post('jobs/:jobId/applications')
  @Roles(UserRole.CANDIDATE)
  @ApiParam(JOB_ID)
  @ApiOperation({ summary: 'Apply to an open job (candidate)' })
  @ApiCreatedResponse({ type: ApplicationResponse })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiForbiddenResponse({ description: 'Not a candidate' })
  @ApiNotFoundResponse({ description: 'Job not found or closed' })
  @ApiConflictResponse({ description: 'Already applied to this job' })
  apply(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.apply(jobId, userId, dto);
  }

  // ─── GET /applications/mine ───────────────────────────────────────────────

  @Get('applications/mine')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'My applications with a job summary (candidate)' })
  @ApiOkResponse({ type: [MyApplicationResponse] })
  @ApiForbiddenResponse({ description: 'Not a candidate' })
  findMine(@CurrentUser('userId') userId: string) {
    return this.applicationsService.findMine(userId);
  }

  // ─── GET /jobs/:jobId/applications ────────────────────────────────────────

  @Get('jobs/:jobId/applications')
  @Roles(UserRole.RECRUITER)
  @ApiParam(JOB_ID)
  @ApiOperation({
    summary: 'Applications of one of my jobs, with candidate info (recruiter)',
    description: 'Withdrawn applications are not listed.',
  })
  @ApiOkResponse({ type: [JobApplicationResponse] })
  @ApiForbiddenResponse({ description: 'Not the owner of the job' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  findForJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.applicationsService.findForJob(jobId, userId);
  }

  // ─── PATCH /applications/:id/status ───────────────────────────────────────

  @Patch('applications/:id/status')
  @Roles(UserRole.RECRUITER)
  @ApiParam(APPLICATION_ID)
  @ApiOperation({
    summary: 'Accept or reject a PENDING application (owner recruiter)',
  })
  @ApiOkResponse({ type: ApplicationResponse })
  @ApiForbiddenResponse({ description: 'Not the owner of the job' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiConflictResponse({ description: 'Application is not PENDING' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(id, userId, dto.status);
  }

  // ─── PATCH /applications/:id/withdraw ─────────────────────────────────────

  @Patch('applications/:id/withdraw')
  @Roles(UserRole.CANDIDATE)
  @ApiParam(APPLICATION_ID)
  @ApiOperation({
    summary:
      'Withdraw a PENDING application (owner candidate) — purged after 30 days',
  })
  @ApiOkResponse({ type: ApplicationResponse })
  @ApiForbiddenResponse({ description: 'Not your application' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiConflictResponse({ description: 'Application is not PENDING' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.applicationsService.withdraw(id, userId);
  }

  // ─── GET /applications/:id/cv-url ─────────────────────────────────────────

  @Get('applications/:id/cv-url')
  @Roles(UserRole.RECRUITER)
  @ApiParam(APPLICATION_ID)
  @ApiOperation({
    summary:
      "Presigned URL (15 min) of the candidate's CV (owner recruiter only)",
  })
  @ApiOkResponse({
    schema: { example: { url: 'https://…X-Amz-Signature=…', expiresIn: 900 } },
  })
  @ApiForbiddenResponse({ description: 'Not the owner / withdrawn' })
  @ApiNotFoundResponse({ description: 'Application or CV not found' })
  getCvUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.applicationsService.getCvUrl(id, userId);
  }
}
