import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

const COOKIE_PATH = '/auth';

export function refreshCookieOptions(
  config: ConfigService,
  expiresAt?: Date,
): CookieOptions {
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: COOKIE_PATH,
    ...(expiresAt ? { maxAge: expiresAt.getTime() - Date.now() } : {}),
  };
}

export function readRefreshCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;

  return cookies?.[REFRESH_COOKIE] ?? null;
}
