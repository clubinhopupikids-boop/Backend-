import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PARENT_ACCESS_SCOPE } from '../constants';
import { ParentAccessTokenService } from 'src/parent-access/parent-access-token.service';
import { ParentAccessGuard } from './parent-access.guard';

describe('ParentAccessGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
  const tokens = { verify: jest.fn() };
  const guard = new ParentAccessGuard(
    reflector as unknown as Reflector,
    tokens as unknown as ParentAccessTokenService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(true);
  });

  it('does not authorize a parent-only endpoint with the normal JWT alone', async () => {
    const context = executionContext({ headers: {}, user: { id: 'responsible-a' } });

    await expect(guard.canActivate(context)).rejects.toThrow('Parent access token required');
    expect(tokens.verify).not.toHaveBeenCalled();
  });

  it('does not authorize an expired parent ticket', async () => {
    tokens.verify.mockRejectedValue(new UnauthorizedException('expired'));
    const context = executionContext({
      headers: { 'x-parent-access-token': 'expired-ticket' },
      user: { id: 'responsible-a' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow('expired');
  });

  it('prevents responsible A from using responsible B parent access', async () => {
    tokens.verify.mockResolvedValue({ sub: 'responsible-b', scope: PARENT_ACCESS_SCOPE });
    const context = executionContext({
      headers: { 'x-parent-access-token': 'ticket-b' },
      user: { id: 'responsible-a' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Parent access does not belong to this session',
    );
  });

  it('authorizes a matching scoped ticket', async () => {
    tokens.verify.mockResolvedValue({ sub: 'responsible-a', scope: PARENT_ACCESS_SCOPE });
    const context = executionContext({
      headers: { 'x-parent-access-token': 'ticket-a' },
      user: { id: 'responsible-a' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

function executionContext(request: object): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
