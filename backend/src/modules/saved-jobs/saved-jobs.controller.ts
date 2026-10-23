import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { SavedJobsService } from './saved-jobs.service';

const JOB_ID = { name: 'id', format: 'uuid', description: 'Job UUID' };

@ApiTags('Saved jobs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Not a candidate' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CANDIDATE)
@Controller()
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Post('jobs/:id/save')
  @HttpCode(HttpStatus.OK)
  @ApiParam(JOB_ID)
  @ApiOperation({ summary: 'Save a job (idempotent)' })
  @ApiOkResponse({
    schema: {
      example: {
        id: '3f0c…',
        jobId: '9a1e…',
        createdAt: '2026-10-19T12:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Job not found' })
  save(
    @Param('id', ParseUUIDPipe) jobId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.savedJobsService.save(jobId, userId);
  }

  @Delete('jobs/:id/save')
  @ApiParam(JOB_ID)
  @ApiOperation({ summary: 'Remove a job from saved jobs (idempotent)' })
  @ApiOkResponse({
    schema: { example: { message: 'Job removed from saved jobs.' } },
  })
  unsave(
    @Param('id', ParseUUIDPipe) jobId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.savedJobsService.unsave(jobId, userId);
  }

  @Get('saved-jobs')
  @ApiOperation({ summary: 'My saved jobs with a job summary' })
  @ApiOkResponse({ description: '[{ id, jobId, createdAt, job: {…} }]' })
  findMine(@CurrentUser('userId') userId: string) {
    return this.savedJobsService.findMine(userId);
  }
}
