import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/roles.enum';

function contextFor(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(requiredRoles: Role[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;

  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('lets a route through when it declares no @Roles', () => {
    // @UseGuards(RolesGuard) without @Roles used to read undefined metadata and
    // throw a 500 off .some(). No requirement means nothing to enforce.
    const guard = guardWith(undefined);

    expect(guard.canActivate(contextFor({ role: Role.USER }))).toBe(true);
  });

  it('lets a route through when @Roles is empty', () => {
    expect(guardWith([]).canActivate(contextFor({ role: Role.USER }))).toBe(
      true,
    );
  });

  it('admits a caller holding the required role', () => {
    const guard = guardWith([Role.ADMIN]);

    expect(guard.canActivate(contextFor({ role: Role.ADMIN }))).toBe(true);
  });

  it('refuses a caller without the required role', () => {
    const guard = guardWith([Role.ADMIN]);

    expect(guard.canActivate(contextFor({ role: Role.USER }))).toBe(false);
  });

  it('fails closed when a role is required but no user is on the request', () => {
    // 403, not a 500 off reading .role of undefined.
    const guard = guardWith([Role.ADMIN]);

    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });
});
