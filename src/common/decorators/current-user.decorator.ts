import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../constants';

/**
 * Returns the authenticated responsible principal from req.user.
 * Throws if used on a @Public route (no principal available).
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error('CurrentUser used on a route without an authenticated principal');
  }
  return user;
});
