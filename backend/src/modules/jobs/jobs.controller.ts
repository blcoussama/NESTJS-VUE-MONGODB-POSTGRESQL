import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import { UserRole } from '../users/schemas/user.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import {
  JobDetailResponse,
  JobResponse,
  MyJobResponse,
  PaginatedJobsResponse,
} from './dto/job-response.dto';
import { JobsService } from './jobs.service';

const JOB_ID = { name: 'id', format: 'uuid', description: 'Job UUID' };

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ─── POST /jobs ───────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Publish a job for your company (recruiter)' })
  @ApiCreatedResponse({ type: JobResponse })
  @ApiBadRequestResponse({ description: 'Invalid body or salary rules' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Not a recruiter / not your company' })
  @ApiNotFoundResponse({ description: 'Company not found' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateJobDto) {
    return this.jobsService.create(userId, dto);
  }

  // ─── GET /jobs ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List open jobs (filters, pagination, sort) — public',
  })
  @ApiOkResponse({ type: PaginatedJobsResponse })
  @ApiBadRequestResponse({ description: 'Invalid query (e.g. limit > 50)' })
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  // ─── GET /jobs/mine (declared before :id) ─────────────────────────────────

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({
    summary: 'My jobs, open and closed, with applicationsCount (recruiter)',
  })
  @ApiOkResponse({ type: [MyJobResponse] })
  @ApiForbiddenResponse({ description: 'Not a recruiter' })
  findMine(@CurrentUser('userId') userId: string) {
    return this.jobsService.findMine(userId);
  }

  // ─── GET /jobs/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam(JOB_ID)
  @ApiOperation({
    summary: 'Job detail — public; adds isSaved/hasApplied for a candidate',
    description:
      'The Bearer token is optional. With a candidate token the response also contains isSaved, hasApplied and applicationStatus.',
  })
  @ApiOkResponse({ type: JobDetailResponse })
  @ApiNotFoundResponse({ description: 'Job not found' })
  @ApiBadRequestResponse({ description: 'id is not a UUID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.jobsService.findOne(id, user);
  }

  // ─── PATCH /jobs/:id ──────────────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(JOB_ID)
  @ApiOperation({ summary: 'Update a job, incl. isOpen (owner recruiter)' })
  @ApiOkResponse({ type: JobResponse })
  @ApiForbiddenResponse({ description: 'Not the owner' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, userId, dto);
  }

  // ─── DELETE /jobs/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(JOB_ID)
  @ApiOperation({
    summary: 'Delete a job (owner) — cascades to applications and saves',
  })
  @ApiOkResponse({
    schema: { example: { message: 'Job deleted successfully.' } },
  })
  @ApiForbiddenResponse({ description: 'Not the owner' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.jobsService.remove(id, userId);
  }
}
