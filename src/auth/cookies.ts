import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request } from 'express';
import { NodeEnv } from '../config/env.validation';
import { API_PREFIX } from '../config/api-prefix';

export const REFRESH_COOKIE = 'refresh_token';

/** Scoped to the auth routes, so ordinary API calls never carry the cookie. */
const COOKIE_PATH = `/${API_PREFIX}/auth`;

export function refreshCookieOptions(
  config: ConfigService,
  expiresAt?: Date,
): CookieOptions {
  const isProduction = config.get<string>('NODE_ENV') === NodeEnv.Production;

  return {
    httpOnly: true,
    secure: isProduction,
    // Lax, not None: the app and the API are served from one origin, so the
    // cookie is never sent cross-site and does not need the weaker setting.
    // SameSite=None exists for a frontend on a different domain — restore it,
    // together with that origin in CORS_ORIGIN, only if the two are split.
    sameSite: 'lax',
    path: COOKIE_PATH,
    ...(expiresAt ? { maxAge: expiresAt.getTime() - Date.now() } : {}),
  };
}

export function readRefreshCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;

  return cookies?.[REFRESH_COOKIE] ?? null;
}
