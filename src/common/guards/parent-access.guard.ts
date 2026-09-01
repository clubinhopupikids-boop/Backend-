import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  PARENT_ACCESS_HEADER,
  REQUIRES_PARENT_ACCESS_KEY,
  type AuthenticatedUser,
} from '../constants';
import { ParentAccessTokenService } from 'src/parent-access/parent-access-token.service';

@Injectable()
export class ParentAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: ParentAccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_PARENT_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[PARENT_ACCESS_HEADER];
    if (typeof header !== 'string' || !header.trim()) {
      throw new UnauthorizedException('Parent access token required');
    }
    const rawToken = header.replace(/^Bearer\s+/i, '').trim();
    const payload = await this.tokens.verify(rawToken);
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || payload.sub !== user.id) {
      throw new UnauthorizedException('Parent access does not belong to this session');
    }
    return true;
  }
}
