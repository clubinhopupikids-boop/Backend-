import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PARENT_ACCESS_SCOPE } from 'src/common/constants';
import { ParentAccessTokenService } from './parent-access-token.service';

describe('ParentAccessTokenService', () => {
  const jwt = new JwtService();
  const cfg = {
    jwtSecret: 'main-session-secret-that-is-long-enough',
    jwtIssuer: 'pupikids',
    parentAccessJwtSecret: 'separate-parent-secret-that-is-long-enough',
    parentAccessTtlSeconds: 900,
  };
  const config = { get: jest.fn().mockReturnValue(cfg) };
  const service = new ParentAccessTokenService(jwt, config as unknown as ConfigService);

  it('issues a scoped 15-minute ticket for the responsible', async () => {
    const grant = await service.issue('responsible-a');
    const payload = await service.verify(grant.parentAccessToken);

    expect(grant.expiresInSeconds).toBe(900);
    expect(payload.sub).toBe('responsible-a');
    expect(payload.scope).toBe(PARENT_ACCESS_SCOPE);
  });

  it('rejects a normal session JWT as parent access', async () => {
    const authToken = await jwt.signAsync(
      { sub: 'responsible-a', email: 'a@example.com' },
      { secret: cfg.jwtSecret, issuer: cfg.jwtIssuer, expiresIn: 3600 },
    );

    await expect(service.verify(authToken)).rejects.toThrow('Parent access expired or invalid');
  });

  it('rejects an expired parent access ticket', async () => {
    const expired = await jwt.signAsync(
      { sub: 'responsible-a', scope: PARENT_ACCESS_SCOPE },
      {
        secret: cfg.parentAccessJwtSecret,
        issuer: `${cfg.jwtIssuer}:parent-access`,
        audience: PARENT_ACCESS_SCOPE,
        expiresIn: -1,
      },
    );

    await expect(service.verify(expired)).rejects.toThrow('Parent access expired or invalid');
  });
});
