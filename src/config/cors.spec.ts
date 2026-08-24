import { corsOriginChecker } from './cors';
import { NodeEnv } from './env.validation';

const check = (
  configured: string,
  nodeEnv: NodeEnv,
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
    expect(check(CONFIGURED, NodeEnv.Production, 'http://localhost:4200')).toBe(
      true,
    );
    expect(
      check(CONFIGURED, NodeEnv.Development, 'https://pulse.example.com'),
    ).toBe(true);
  });

  it('allows a request with no Origin header (curl, same-origin)', () => {
    expect(check(CONFIGURED, NodeEnv.Production, undefined)).toBe(true);
  });

  describe('in development and test', () => {
    it.each([NodeEnv.Development, NodeEnv.Test])(
      'accepts loopback in %s',
      (env) => {
        expect(check(CONFIGURED, env, 'http://127.0.0.1:4200')).toBe(true);
        expect(check(CONFIGURED, env, 'http://localhost:4201')).toBe(true);
        expect(check(CONFIGURED, env, 'http://[::1]:5173')).toBe(true);
      },
    );

    it('accepts https loopback — ng serve --ssl', () => {
      expect(
        check(CONFIGURED, NodeEnv.Development, 'https://localhost:4200'),
      ).toBe(true);
    });

    it('accepts loopback on the default port', () => {
      expect(check(CONFIGURED, NodeEnv.Development, 'http://localhost')).toBe(
        true,
      );
      expect(check(CONFIGURED, NodeEnv.Development, 'https://[::1]')).toBe(
        true,
      );
    });

    it('refuses a hostname that merely looks like loopback', () => {
      expect(
        check(CONFIGURED, NodeEnv.Development, 'http://localhost.evil.com'),
      ).toBe(false);
      expect(
        check(
          CONFIGURED,
          NodeEnv.Development,
          'https://127.0.0.1.evil.com:4200',
        ),
      ).toBe(false);
      expect(
        check(
          CONFIGURED,
          NodeEnv.Development,
          'http://localhost:4200.evil.com',
        ),
      ).toBe(false);
    });

    it('refuses credentials smuggled through userinfo', () => {
      // hostname here is evil.com, not localhost
      expect(
        check(
          CONFIGURED,
          NodeEnv.Development,
          'http://localhost:4200@evil.com',
        ),
      ).toBe(false);
    });

    it('refuses non-http schemes and unparseable origins', () => {
      expect(check(CONFIGURED, NodeEnv.Development, 'file://localhost')).toBe(
        false,
      );
      expect(
        check(
          CONFIGURED,
          NodeEnv.Development,
          'javascript:alert(1)//localhost',
        ),
      ).toBe(false);
      // a sandboxed iframe sends the literal string "null"
      expect(check(CONFIGURED, NodeEnv.Development, 'null')).toBe(false);
      expect(check(CONFIGURED, NodeEnv.Development, 'not a url')).toBe(false);
    });
  });

  describe('in production', () => {
    it('refuses loopback that is not explicitly configured', () => {
      expect(
        check(CONFIGURED, NodeEnv.Production, 'http://127.0.0.1:4200'),
      ).toBe(false);
      expect(
        check(CONFIGURED, NodeEnv.Production, 'http://localhost:9999'),
      ).toBe(false);
      expect(
        check(CONFIGURED, NodeEnv.Production, 'https://localhost:4200'),
      ).toBe(false);
    });

    it('refuses anything not on the list', () => {
      expect(
        check(
          CONFIGURED,
          NodeEnv.Production,
          'https://pulse.example.com.evil.co',
        ),
      ).toBe(false);
    });
  });

  it('fails closed for an unrecognised environment value', () => {
    // the regression this guards: an unset or typo'd NODE_ENV must not be read
    // as "not production" and therefore permissive
    const unknown = 'staging' as NodeEnv;

    expect(check(CONFIGURED, unknown, 'http://127.0.0.1:4200')).toBe(false);
    expect(
      check(
        CONFIGURED,
        undefined as unknown as NodeEnv,
        'http://localhost:9999',
      ),
    ).toBe(false);
  });

  it('tolerates spaces and empties in the configured list', () => {
    expect(
      check(
        ' http://a.test , , http://b.test ',
        NodeEnv.Production,
        'http://b.test',
      ),
    ).toBe(true);
  });
});
