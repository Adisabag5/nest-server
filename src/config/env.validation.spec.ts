import 'reflect-metadata';
import { validateEnv, NodeEnv } from './env.validation';

const VALID = {
  NODE_ENV: 'development',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: 'secret',
  DB_NAME: 'pulse',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:4200',
};

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    expect(validateEnv(VALID).NODE_ENV).toBe(NodeEnv.Development);
  });

  it('refuses to boot without NODE_ENV', () => {
    const withoutNodeEnv = { ...VALID };
    delete (withoutNodeEnv as Partial<typeof VALID>).NODE_ENV;

    // the whole point: an unset NODE_ENV used to mean "not production", which
    // silently opened CORS to loopback and dropped Secure from the refresh cookie
    expect(() => validateEnv(withoutNodeEnv)).toThrow(/NODE_ENV/);
  });

  it('refuses an unrecognised NODE_ENV rather than treating it as non-production', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'prod' })).toThrow(
      /NODE_ENV/,
    );
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('still enforces the secret lengths', () => {
    expect(() => validateEnv({ ...VALID, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
