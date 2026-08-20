import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { readRefreshCookie } from '../cookies';

export interface RefreshPayload {
  sub: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => readRefreshCookie(req),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshPayload) {
    const refreshToken = readRefreshCookie(req);

    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    return { id: payload.sub, refreshToken };
  }
}
