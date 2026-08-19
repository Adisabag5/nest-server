import { plainToInstance } from 'class-transformer';
import {
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
 * The shape the app requires from the environment. Same trick as the DTOs:
 * the decorators survive compilation as metadata, so they can be checked at
 * runtime — here, once, at boot.
 */
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

  // a short secret is a guessable secret — the token signature is only as
  // strong as this string
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // ms-style duration accepted by @nestjs/jwt, e.g. '15m', '1h', '7d'
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;
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
