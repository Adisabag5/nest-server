import 'reflect-metadata';
import {
  THROTTLER_BLOCK_DURATION,
  THROTTLER_LIMIT,
  THROTTLER_SKIP,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { AUTH_THROTTLE, THROTTLERS } from './throttle';

interface ThrottleMetadata {
  limit?: number;
  ttl?: number;
  blockDuration?: number;
}

/** Reflect.getMetadata is `any`; narrow it once, here. */
function meta(key: string, target: object): number | undefined {
  return Reflect.getMetadata(key, target) as number | undefined;
}

/** Read what @Throttle wrote onto a handler. */
function limitFor(controller: object, method: string): ThrottleMetadata {
  const handler = (controller as Record<string, object>)[method];

  return {
    limit: meta(`${THROTTLER_LIMIT}default`, handler),
    ttl: meta(`${THROTTLER_TTL}default`, handler),
    blockDuration: meta(`${THROTTLER_BLOCK_DURATION}default`, handler),
  };
}

describe('rate limiting', () => {
  describe('the limits themselves', () => {
    it('keeps the auth limit far below the default', () => {
      const fallback = THROTTLERS.find((t) => t.name === 'default')!;

      // the whole point: grinding passwords must not get the generous budget
      // that ordinary browsing does
      expect(AUTH_THROTTLE.default.limit).toBeLessThan(
        fallback.limit as number,
      );
    });

    it('holds the door shut after the limit, rather than reopening next window', () => {
      expect(AUTH_THROTTLE.default.blockDuration).toBeGreaterThan(
        AUTH_THROTTLE.default.ttl,
      );
    });
  });

  describe('where it is applied', () => {
    it.each(['signup', 'signIn'])('throttles %s strictly', (method) => {
      expect(limitFor(AuthController.prototype, method)).toEqual({
        limit: AUTH_THROTTLE.default.limit,
        ttl: AUTH_THROTTLE.default.ttl,
        blockDuration: AUTH_THROTTLE.default.blockDuration,
      });
    });

    it('leaves refresh on the default budget', () => {
      // refresh runs on every page load, and reuse detection already punishes
      // a replayed token far more precisely than a rate limit could
      expect(
        limitFor(AuthController.prototype, 'refresh').limit,
      ).toBeUndefined();
    });

    it('does not throttle the health check', () => {
      // monitoring polls it on a fixed interval; throttling it would turn a
      // routine check into a page at 3am
      expect(
        Reflect.getMetadata(`${THROTTLER_SKIP}default`, HealthController),
      ).toBe(true);
    });
  });
});
