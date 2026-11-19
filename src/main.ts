import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { corsOriginChecker } from './config/cors';
import { NodeEnv } from './config/env.validation';
import { API_PREFIX } from './config/api-prefix';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

  // See TRUST_PROXY in env.validation.ts: this is what makes req.ip the real
  // caller behind a reverse proxy, and therefore what rate limiting counts.
  const trustProxy = config.get<number>('TRUST_PROXY');
  if (trustProxy) app.set('trust proxy', Number(trustProxy));

  // Everything the server answers lives under /api. Without it, the Angular
  // route /auth and the API's /auth/* endpoints share a path: they only avoid
  // each other today because the page is a GET and the endpoints are POSTs,
  // and the first GET added under /auth would shadow the sign-in page.
  app.setGlobalPrefix(API_PREFIX);

  app.enableCors({
    origin: corsOriginChecker(
      config.get<string>('CORS_ORIGIN')!,
      config.get<NodeEnv>('NODE_ENV')!,
    ),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  serveClientIfBuilt(app, config);

  // Let Nest close the DB pool and in-flight requests when the process manager
  // sends SIGTERM, instead of dropping them mid-flight on every deploy.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

/**
 * Serve the built Angular app from the same origin, when CLIENT_DIST points at
 * a build. Unset — which is every dev machine and both test suites — the server
 * stays API-only and behaves exactly as before.
 *
 * The fallback is what makes deep links work: the browser asking for /auth or
 * /beats directly must get index.html so the router can take over, while
 * anything under the API prefix and any real file is left alone.
 */
function serveClientIfBuilt(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  const configured = config.get<string>('CLIENT_DIST');
  if (!configured) return;

  const dist = resolve(configured);
  const indexHtml = join(dist, 'index.html');

  if (!existsSync(indexHtml)) {
    // Loud, because the alternative is a site that 404s every page and looks
    // like a routing bug rather than a missing build.
    throw new Error(
      `CLIENT_DIST is set but ${indexHtml} does not exist. Build the frontend, or unset CLIENT_DIST to run API-only.`,
    );
  }

  app.useStaticAssets(dist, { index: false });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith(`/${API_PREFIX}`)) {
      return next();
    }

    return res.sendFile(indexHtml);
  });
}

void bootstrap();
