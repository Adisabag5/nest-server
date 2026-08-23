export type OriginCallback = (error: Error | null, allowed: boolean) => void;
export type OriginChecker = (
  origin: string | undefined,
  callback: OriginCallback,
) => void;

/** http://localhost:4200, http://127.0.0.1:5173, http://[::1]:8080 — any port. */
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

/**
 * Builds the `origin` check for enableCors.
 *
 * Outside production any loopback origin is accepted, because `localhost:4200`
 * and `127.0.0.1:4200` are different origins to a browser even though they are
 * the same server — a distinction that costs a developer an afternoon and buys
 * nothing locally. In production only the configured list is accepted, since
 * `credentials: true` means an allowed origin can read authenticated responses.
 */
export function corsOriginChecker(
  configured: string,
  nodeEnv: string | undefined,
): OriginChecker {
  const allowList = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = nodeEnv === 'production';

  return (origin, callback) => {
    // no Origin header: same-origin navigation, curl, or a server-to-server call
    if (!origin) return callback(null, true);

    if (allowList.includes(origin)) return callback(null, true);

    if (!isProduction && LOOPBACK.test(origin)) return callback(null, true);

    // omit the header rather than erroring: the browser blocks it either way,
    // and a rejected origin is not a server fault worth a 500
    return callback(null, false);
  };
}
