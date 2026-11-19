/**
 * Every server route is mounted under this prefix. It lives in its own file so
 * main.ts and the refresh cookie's Path cannot drift apart — a cookie scoped to
 * the wrong path is sent on no request at all, and the failure looks like a
 * broken session rather than a broken path.
 */
export const API_PREFIX = 'api';
