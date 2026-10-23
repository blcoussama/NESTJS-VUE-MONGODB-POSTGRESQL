import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/schemas/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Must run AFTER JwtAuthGuard: `@UseGuards(JwtAuthGuard, RolesGuard)`.
 * Fails closed (403) if no authenticated user is attached to the request.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { role?: UserRole };
    }>();
    const role = request.user?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `This action requires the ${requiredRoles.join(' or ')} role.`,
      );
    }
    return true;
  }
}
