import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, AuthResponse, AuthSession } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { Public } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { REFRESH_COOKIE, refreshCookieOptions } from './cookies';

interface RefreshRequest extends Request {
  user: { id: string; refreshToken: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.sendSession(await this.authService.signup(createUserDto), res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.signIn(
      signInDto.email,
      signInDto.password,
    );

    return this.sendSession(session, res);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.refresh(req.user.refreshToken);

    return this.sendSession(session, res);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('signout')
  async signOut(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.signOut(req.user.refreshToken);

    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.config));

    return result;
  }

  private sendSession(session: AuthSession, res: Response): AuthResponse {
    res.cookie(
      REFRESH_COOKIE,
      session.refresh_token,
      refreshCookieOptions(this.config, session.refresh_expires_at),
    );

    return { access_token: session.access_token, user: session.user };
  }
}
