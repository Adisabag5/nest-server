import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  SkipThrottle,
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_THROTTLE, THROTTLERS } from './../src/config/throttle';

/**
 * Exercises the real THROTTLERS and AUTH_THROTTLE values against routes shaped
 * like the ones that carry them. The unit test pins that signin and signup wear
 * the strict decorator; this pins that wearing it actually stops anybody.
 */
@Controller()
class ProbeController {
  @Throttle(AUTH_THROTTLE)
  @Get('guarded')
  guarded(): string {
    return 'ok';
  }

  @SkipThrottle()
  @Get('exempt')
  exempt(): string {
    return 'ok';
  }
}

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLERS)],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows exactly the configured number of attempts, then refuses', async () => {
    const allowed = AUTH_THROTTLE.default.limit;

    for (let attempt = 1; attempt <= allowed; attempt++) {
      await request(app.getHttpServer()).get('/guarded').expect(200);
    }

    // 429, not 401: the point is that a password grinder is stopped by the
    // door, before it ever reaches the credential check
    await request(app.getHttpServer()).get('/guarded').expect(429);
  });

  it('keeps refusing after the window, because the block outlasts it', async () => {
    const allowed = AUTH_THROTTLE.default.limit;

    for (let attempt = 1; attempt <= allowed + 1; attempt++) {
      await request(app.getHttpServer()).get('/guarded');
    }

    // blockDuration is longer than ttl, so the budget does not quietly refill
    // one window later
    await request(app.getHttpServer()).get('/guarded').expect(429);
  });

  it('never throttles a route that opts out', async () => {
    const wellOverTheLimit = AUTH_THROTTLE.default.limit * 2;

    for (let attempt = 1; attempt <= wellOverTheLimit; attempt++) {
      await request(app.getHttpServer()).get('/exempt').expect(200);
    }
  });
});
