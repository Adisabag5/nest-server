import { ThrottlerOptions } from '@nestjs/throttler';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * Rate limits, per client IP, held in memory.
 *
 * In-memory means each process counts on its own and a restart forgets
 * everything. That is the right trade for one VPS instance: a shared Redis
 * store would be a second thing to run and to keep alive, and an attacker
 * cannot choose when the server restarts. Revisit it the day a second instance
 * exists, because by then the effective limit silently doubles.
 */
export const THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'default',
    ttl: MINUTE,
    limit: 120,
  },
];

/**
 * Sign-in and sign-up, which are the two routes worth grinding: one guesses
 * passwords, the other mints accounts. Deliberately far below the default.
 *
 * Ten a minute is generous for a person who is typing and fixing a typo, and
 * useless for a dictionary. blockDuration holds the door shut for five minutes
 * once the limit is hit, so the cost of guessing does not reset every minute.
 */
export const AUTH_THROTTLE = {
  default: {
    limit: 10,
    ttl: MINUTE,
    blockDuration: 5 * MINUTE,
  },
};
