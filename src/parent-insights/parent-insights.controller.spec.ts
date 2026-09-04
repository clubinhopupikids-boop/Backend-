import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_PARENT_ACCESS_KEY } from 'src/common/constants';
import { ParentAccessGuard } from 'src/common/guards/parent-access.guard';
import { ParentAccessTokenService } from 'src/parent-access/parent-access-token.service';
import { ParentInsightsController } from './parent-insights.controller';

describe('ParentInsightsController security contract', () => {
  it.each([
    ParentInsightsController.prototype.insights,
    ParentInsightsController.prototype.activityHistory,
  ])('requires a parent access token for every parental read', (handler) => {
    const reflector = new Reflector();
    expect(
      reflector.getAllAndOverride<boolean>(REQUIRES_PARENT_ACCESS_KEY, [
        handler,
        ParentInsightsController,
      ]),
    ).toBe(true);
  });

  it('rejects a normal JWT without its matching parent access token', async () => {
    const reflector = new Reflector();
    const tokens = { verify: jest.fn() };
    const guard = new ParentAccessGuard(reflector, tokens as unknown as ParentAccessTokenService);
    const context = {
      getHandler: () => ParentInsightsController.prototype.insights,
      getClass: () => ParentInsightsController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, user: { id: 'responsible-1' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a parent token issued for a different JWT owner', async () => {
    const reflector = new Reflector();
    const tokens = { verify: jest.fn().mockResolvedValue({ sub: 'responsible-2' }) };
    const guard = new ParentAccessGuard(reflector, tokens as unknown as ParentAccessTokenService);
    const context = {
      getHandler: () => ParentInsightsController.prototype.activityHistory,
      getClass: () => ParentInsightsController,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-parent-access-token': 'parent-token' },
          user: { id: 'responsible-1' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
