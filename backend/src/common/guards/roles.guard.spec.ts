import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../modules/users/schemas/user.schema';

function context(user?: { role?: string }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('lets any authenticated user through when no @Roles() is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(context({ role: UserRole.CANDIDATE }))).toBe(true);
  });

  it('allows a matching role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.RECRUITER]);

    expect(guard.canActivate(context({ role: UserRole.RECRUITER }))).toBe(true);
  });

  it('throws 403 for another role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.RECRUITER]);

    expect(() =>
      guard.canActivate(context({ role: UserRole.CANDIDATE })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed (403, not a 500) when no user is attached', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.CANDIDATE]);

    expect(() => guard.canActivate(context(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
