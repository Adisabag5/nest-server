import { corsOriginChecker } from './cors';

const check = (
  configured: string,
  nodeEnv: string | undefined,
  origin: string | undefined,
): boolean => {
  let allowed = false;
  corsOriginChecker(configured, nodeEnv)(origin, (_error, result) => {
    allowed = result;
  });

  return allowed;
};

const CONFIGURED = 'http://localhost:4200,https://pulse.example.com';

describe('corsOriginChecker', () => {
  it('allows a configured origin in any environment', () => {
    expect(check(CONFIGURED, 'production', 'http://localhost:4200')).toBe(true);
    expect(check(CONFIGURED, undefined, 'https://pulse.example.com')).toBe(
      true,
    );
  });

  it('allows a request with no Origin header (curl, same-origin)', () => {
    expect(check(CONFIGURED, 'production', undefined)).toBe(true);
  });

  describe('outside production', () => {
    it('accepts loopback on any port and hostname spelling', () => {
      // the case that actually bites: same server, different origin
      expect(check(CONFIGURED, undefined, 'http://127.0.0.1:4200')).toBe(true);
      expect(check(CONFIGURED, 'development', 'http://localhost:4201')).toBe(
        true,
      );
      expect(check(CONFIGURED, undefined, 'http://[::1]:5173')).toBe(true);
    });

    it('still refuses a non-loopback origin', () => {
      expect(check(CONFIGURED, undefined, 'http://evil.example.com')).toBe(
        false,
      );
      // a hostname that merely starts with localhost is not loopback
      expect(check(CONFIGURED, undefined, 'http://localhost.evil.com')).toBe(
        false,
      );
      expect(
        check(CONFIGURED, undefined, 'https://127.0.0.1.evil.com:4200'),
      ).toBe(false);
    });
  });

  describe('in production', () => {
    it('refuses loopback that is not explicitly configured', () => {
      expect(check(CONFIGURED, 'production', 'http://127.0.0.1:4200')).toBe(
        false,
      );
      expect(check(CONFIGURED, 'production', 'http://localhost:9999')).toBe(
        false,
      );
    });

    it('refuses anything not on the list', () => {
      expect(
        check(CONFIGURED, 'production', 'https://pulse.example.com.evil.co'),
      ).toBe(false);
    });
  });

  it('tolerates spaces and empties in the configured list', () => {
    expect(
      check(' http://a.test , , http://b.test ', 'production', 'http://b.test'),
    ).toBe(true);
  });
});
