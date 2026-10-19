import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthThrottle } from '../../common/throttle/auth-throttle.decorator';
import { AUTH_THROTTLE } from '../../common/throttle/throttle.constants';
import { REFRESH_COOKIE } from './auth.constants';

const TOO_MANY = { description: 'Rate limit exceeded' };

@ApiTags('Auth')
@ApiTooManyRequestsResponse(TOO_MANY)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @AuthThrottle(AUTH_THROTTLE.signup)
  @ApiOperation({ summary: 'Create a new account (candidate or recruiter)' })
  @ApiCreatedResponse({
    description: 'Account created, verification email sent',
    schema: {
      example: {
        message: 'Account created. Check your email to verify your account.',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid body (password 8-72 bytes)' })
  @ApiConflictResponse({ description: 'Email already in use' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.verifyEmail)
  @ApiOperation({ summary: 'Verify email address with token from email' })
  @ApiOkResponse({ description: 'Email verified successfully' })
  @ApiBadRequestResponse({ description: 'Invalid or expired token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.resendVerification)
  @ApiOperation({
    summary: 'Send a new verification email (same response in every case)',
  })
  @ApiOkResponse({ description: 'Generic confirmation message' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.login)
  @ApiOperation({
    summary: 'Login — returns access token + sets refresh token cookie',
  })
  @ApiOkResponse({
    description:
      'Access token + user info. Refresh token set as httpOnly cookie (path /api/auth).',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs…',
        user: {
          id: '6710f0c2a1b2c3d4e5f60718',
          firstName: 'Oussama',
          lastName: 'Belcadi',
          email: 'oussama@example.com',
          role: 'candidate',
          avatarUrl: null,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or email not verified',
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.refresh)
  @ApiOperation({
    summary:
      'Rotate refresh token — returns new access token (reuse of an old token revokes the session)',
  })
  @ApiCookieAuth('RefreshToken')
  @ApiOkResponse({
    description: 'New access token issued, refresh token rotated in cookie',
    schema: { example: { accessToken: 'eyJhbGciOiJIUzI1NiIs…' } },
  })
  @ApiUnauthorizedResponse({ description: 'Access denied' })
  refresh(
    @CurrentUser('userId') userId: string,
    @CurrentUser('familyId') familyId: string,
    @CurrentUser('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(userId, familyId, refreshToken, res);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout — revokes the current session and clears the cookie',
  })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Logged out successfully' })
  logout(
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.[
      REFRESH_COOKIE
    ];
    return this.authService.logout(
      userId,
      typeof cookie === 'string' ? cookie : undefined,
      res,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.forgotPassword)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiOkResponse({
    description: 'Reset email sent (same response whether email exists or not)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @AuthThrottle(AUTH_THROTTLE.resetPassword)
  @ApiOperation({
    summary: 'Reset password with token from email (revokes all sessions)',
  })
  @ApiOkResponse({ description: 'Password reset successfully' })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
