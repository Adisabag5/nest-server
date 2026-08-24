import { NodeEnv } from './env.validation';

export type OriginCallback = (error: Error | null, allowed: boolean) => void;
export type OriginChecker = (
  origin: string | undefined,
  callback: OriginCallback,
) => void;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Parsed rather than pattern-matched. A regex has to decide up front whether a
 * port and a scheme are optional, and gets both wrong: `https://localhost:4200`
 * (ng serve --ssl) and `http://localhost` (default port) are loopback too.
 * The parser also strips tricks a pattern must be written carefully to survive —
 * `http://localhost:4200@evil.com` has hostname `evil.com`, and a malformed
 * origin throws rather than partially matching.
 */
function isLoopback(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);

    return (
      (protocol === 'http:' || protocol === 'https:') &&
      LOOPBACK_HOSTS.has(hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Builds the `origin` check for enableCors.
 *
 * The loopback allowance is opt-in on an explicit development/test value, not
 * "anything that isn't production". Defaulting to permissive means a deployment
 * that forgets NODE_ENV accepts every localhost origin with credentials — and
 * since an attacker only needs a page served from the victim's own machine,
 * that is a real hole rather than a theoretical one.
 */
export function corsOriginChecker(
  configured: string,
  nodeEnv: NodeEnv,
): OriginChecker {
  const allowList = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowsLoopback =
    nodeEnv === NodeEnv.Development || nodeEnv === NodeEnv.Test;

  return (origin, callback) => {
    // no Origin header: same-origin navigation, curl, or a server-to-server call
    if (!origin) return callback(null, true);

    if (allowList.includes(origin)) return callback(null, true);

    if (allowsLoopback && isLoopback(origin)) return callback(null, true);

    // omit the header rather than erroring: the browser blocks it either way,
    // and a rejected origin is not a server fault worth a 500
    return callback(null, false);
  };
}
