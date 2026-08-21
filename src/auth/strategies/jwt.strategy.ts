import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from 'src/config/app.config';
import type { AuthenticatedUser, JwtPayload } from 'src/common/constants';

/**
 * JWT strategy. Verifies signature + expiry and exposes the principal as
 * req.user. Only `sub` (responsible id) and `email` are placed in the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    jwtService: JwtService,
  ) {
    const cfg = config.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.jwtSecret,
      issuer: cfg.jwtIssuer,
    });
    // jwtService injected to ensure the JwtModule is available; reference kept
    // to satisfy DI without unused-variable warnings.
    void jwtService;
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
