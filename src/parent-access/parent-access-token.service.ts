import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from 'src/config/app.config';
import { PARENT_ACCESS_SCOPE, type ParentAccessTokenPayload } from 'src/common/constants';

@Injectable()
export class ParentAccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private cfg(): AppConfig {
    return this.config.get<AppConfig>('app')!;
  }

  async issue(responsibleId: string): Promise<{
    parentAccessToken: string;
    expiresInSeconds: number;
  }> {
    const cfg = this.cfg();
    const parentAccessToken = await this.jwt.signAsync(
      { sub: responsibleId, scope: PARENT_ACCESS_SCOPE },
      {
        secret: cfg.parentAccessJwtSecret,
        issuer: `${cfg.jwtIssuer}:parent-access`,
        audience: PARENT_ACCESS_SCOPE,
        expiresIn: cfg.parentAccessTtlSeconds,
      },
    );
    return { parentAccessToken, expiresInSeconds: cfg.parentAccessTtlSeconds };
  }

  async verify(token: string): Promise<ParentAccessTokenPayload> {
    const cfg = this.cfg();
    try {
      const payload = await this.jwt.verifyAsync<ParentAccessTokenPayload>(token, {
        secret: cfg.parentAccessJwtSecret,
        issuer: `${cfg.jwtIssuer}:parent-access`,
        audience: PARENT_ACCESS_SCOPE,
      });
      if (!payload.sub || payload.scope !== PARENT_ACCESS_SCOPE) {
        throw new UnauthorizedException('Invalid parent access scope');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Parent access expired or invalid');
    }
  }
}
