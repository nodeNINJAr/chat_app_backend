import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'refreshToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Create an account and start a session' })
  @Post('register')
  async register(
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  @Public()
  @ApiOperation({ summary: 'Authenticate with username/email + password' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  @Public()
  @ApiOperation({
    summary:
      'Rotate the refresh token (read from httpOnly cookie) for a new access token',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.extractRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('missing refresh token');
    }
    const tokens: TokenPair = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.extractRefreshCookie(req);
    if (refreshToken) {
      await this.authService.logout(user.userId, refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { success: true };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
  }

  private extractRefreshCookie(req: Request): string | undefined {
    const cookies: unknown = req.cookies;
    if (!cookies || typeof cookies !== 'object') {
      return undefined;
    }
    const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  private cookieOptions(): CookieOptions {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      // Frontend (Vercel) and backend (VPS) are different sites in production,
      // so the refresh cookie must be sendable cross-site. SameSite=None requires
      // Secure, which is already forced on whenever this matters.
      sameSite: isProd ? 'none' : 'strict',
      path: '/auth',
    };
  }
}
