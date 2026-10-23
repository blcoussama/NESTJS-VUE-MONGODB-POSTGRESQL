import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileValidationPipe } from '../../common/files/file-validation.pipe';
import { LOGO_UPLOAD, multerOptionsFor } from '../../common/files/upload-rules';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_ID = { name: 'id', format: 'uuid', description: 'Company UUID' };

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ─── POST /companies ──────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create a company (recruiters only, one each)' })
  @ApiCreatedResponse({ description: 'Company created' })
  @ApiBadRequestResponse({ description: 'Invalid body or already has one' })
  @ApiConflictResponse({ description: 'Company name already taken' })
  @ApiForbiddenResponse({ description: 'Not a recruiter' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(userId, dto);
  }

  // ─── GET /companies ───────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  findAll() {
    return this.companiesService.findAll();
  }

  // ─── GET /companies/mine (declared before :id) ────────────────────────────

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiOperation({ summary: "Get the current recruiter's company" })
  @ApiOkResponse({ description: 'The company (with _count.jobs)' })
  @ApiNotFoundResponse({ description: 'No company created yet' })
  @ApiForbiddenResponse({ description: 'Not a recruiter' })
  findMine(@CurrentUser('userId') userId: string) {
    return this.companiesService.findMine(userId);
  }

  // ─── GET /companies/:id ───────────────────────────────────────────────────

  @Get(':id')
  @ApiParam(COMPANY_ID)
  @ApiOperation({ summary: 'Get a company by ID (with its open jobs)' })
  @ApiNotFoundResponse({ description: 'Company not found' })
  @ApiBadRequestResponse({ description: 'id is not a UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findOne(id);
  }

  // ─── PATCH /companies/:id ─────────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(COMPANY_ID)
  @ApiOperation({ summary: 'Update a company (owner only)' })
  @ApiForbiddenResponse({ description: 'Not the owner' })
  @ApiNotFoundResponse({ description: 'Company not found' })
  @ApiConflictResponse({ description: 'Company name already taken' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, userId, dto);
  }

  // ─── DELETE /companies/:id ────────────────────────────────────────────────

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(COMPANY_ID)
  @ApiOperation({
    summary: 'Delete a company (owner only — cascades to its jobs)',
  })
  @ApiForbiddenResponse({ description: 'Not the owner' })
  @ApiNotFoundResponse({ description: 'Company not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.companiesService.remove(id, userId);
  }

  // ─── POST /companies/:id/logo ─────────────────────────────────────────────

  @Post(':id/logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(COMPANY_ID)
  @ApiOperation({ summary: 'Upload company logo (owner only — max 2MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing file or invalid type' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 2MB' })
  @UseInterceptors(FileInterceptor('file', multerOptionsFor(LOGO_UPLOAD)))
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile(new FileValidationPipe(LOGO_UPLOAD))
    file: Express.Multer.File,
  ) {
    return this.companiesService.uploadLogo(id, userId, file);
  }

  // ─── DELETE /companies/:id/logo ───────────────────────────────────────────

  @Delete(':id/logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RECRUITER)
  @ApiParam(COMPANY_ID)
  @ApiOperation({ summary: 'Delete company logo (owner only)' })
  deleteLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.companiesService.deleteLogo(id, userId);
  }
}
