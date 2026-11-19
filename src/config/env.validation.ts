import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Required, not optional. Both the CORS allowlist and the refresh cookie's
 * secure/SameSite flags key off this value, so an unset NODE_ENV in a real
 * deployment silently downgrades security rather than failing loudly.
 */
export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  /**
   * Absolute path to the built Angular app. Set it and the server serves the
   * frontend from the same origin; leave it out and the server is API-only,
   * which is what every dev machine and both test suites want.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  CLIENT_DIST?: string;

  /**
   * How many reverse proxies sit in front of the app — 1 behind the nginx in
   * DEPLOY.md, unset when Node is exposed directly.
   *
   * It decides what `req.ip` is, and therefore what rate limiting counts. Unset
   * behind nginx, every request looks like it came from nginx and all callers
   * share one bucket, so a handful of sign-in attempts locks out the world.
   * Set when there is no proxy, a client can forge X-Forwarded-For and have a
   * fresh bucket per request. Both failure modes are silent, which is why this
   * is explicit rather than inferred from NODE_ENV.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  TRUST_PROXY?: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const keys = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid or missing environment variables: ${keys}`);
  }

  return validated;
}
