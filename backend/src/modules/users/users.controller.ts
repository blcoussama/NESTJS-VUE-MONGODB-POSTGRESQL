import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiConsumes,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileValidationPipe } from '../../common/files/file-validation.pipe';
import {
  AVATAR_UPLOAD,
  CV_UPLOAD,
  multerOptionsFor,
} from '../../common/files/upload-rules';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';
import { UserRole } from './schemas/user.schema';
import { UsersService } from './users.service';

const FILE_BODY = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiExtraModels(UpdateCandidateProfileDto, UpdateRecruiterProfileDto)
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users/me ────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile (never returns password/tokens/CV key)',
  })
  @ApiOkResponse({ description: 'Profile (candidate profiles include hasCv)' })
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  // ─── PATCH /users/me ──────────────────────────────────────────────────────

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'The body is validated against the DTO of the caller role (candidate or recruiter). ' +
      'Unknown or sensitive fields (role, email, password, avatarUrl, cvKey, tokens…) → 400.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(UpdateCandidateProfileDto) },
        { $ref: getSchemaPath(UpdateRecruiterProfileDto) },
      ],
    },
  })
  @ApiOkResponse({ description: 'Updated profile' })
  @ApiBadRequestResponse({ description: 'Invalid or forbidden field' })
  updateMyProfile(
    @CurrentUser('userId') userId: string,
    // Typed as unknown on purpose: validated in the service against the
    // DTO of the role stored in the database
    @Body() body: unknown,
  ) {
    return this.usersService.updateMyProfile(userId, body);
  }

  // ─── POST /users/me/avatar ────────────────────────────────────────────────

  @Post('me/avatar')
  @ApiOperation({
    summary: 'Upload profile avatar (JPEG, PNG, WebP — max 2MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOkResponse({
    schema: {
      example: {
        avatarUrl:
          'https://bucket.s3.eu-west-3.amazonaws.com/avatars/0b5f….png',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing file or invalid type' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 2MB' })
  @UseInterceptors(FileInterceptor('file', multerOptionsFor(AVATAR_UPLOAD)))
  uploadAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile(new FileValidationPipe(AVATAR_UPLOAD))
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  // ─── DELETE /users/me/avatar ──────────────────────────────────────────────

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Delete profile avatar' })
  deleteAvatar(@CurrentUser('userId') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }

  // ─── POST /users/me/cv ────────────────────────────────────────────────────

  @Post('me/cv')
  @ApiOperation({ summary: 'Upload CV PDF (candidates only — max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiBadRequestResponse({ description: 'Missing file or not a real PDF' })
  @ApiForbiddenResponse({ description: 'Not a candidate' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 5MB' })
  @UseInterceptors(FileInterceptor('file', multerOptionsFor(CV_UPLOAD)))
  uploadCv(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile(new FileValidationPipe(CV_UPLOAD)) file: Express.Multer.File,
  ) {
    return this.usersService.uploadCv(userId, role, file);
  }

  // ─── GET /users/me/cv-url ─────────────────────────────────────────────────

  @Get('me/cv-url')
  @ApiOperation({
    summary:
      'Get presigned URL to download CV (candidates only — expires in 15 min)',
  })
  @ApiOkResponse({
    schema: { example: { url: 'https://…X-Amz-Signature=…', expiresIn: 900 } },
  })
  getCvPresignedUrl(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.usersService.getCvPresignedUrl(userId, role);
  }

  // ─── DELETE /users/me/cv ──────────────────────────────────────────────────

  @Delete('me/cv')
  @ApiOperation({ summary: 'Delete CV (candidates only)' })
  deleteCv(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.usersService.deleteCv(userId, role);
  }
}
