import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on the route means no role requirement, so this guard has
    // nothing to say. Without this, applying @UseGuards(RolesGuard) on its own
    // reads undefined metadata and throws a 500 off `.some()` — the same shape
    // as JwtAuthGuard letting @Public() routes straight through.
    if (!requiredRoles?.length) return true;

    // A role IS required from here on, so anything unexpected must fail closed.
    // JwtAuthGuard runs first and populates request.user, but a guard that
    // throws when it is missing turns a 403 into a 500.
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: Role } }>();

    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
