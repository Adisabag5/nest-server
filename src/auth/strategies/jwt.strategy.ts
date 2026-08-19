import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // an expired token is not a valid token
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  /**
   * Runs only after the signature and expiry already checked out. Whatever it
   * returns becomes `request.user` for the rest of the request.
   */
  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
