import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a token. Protection is global and
 * opt-out: a new controller is guarded the moment it exists, and opening a
 * route is an explicit, greppable, reviewable act.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
