import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from 'src/config/app.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordHasher } from './password-hasher';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const cfg = config.get<AppConfig>('app')!;
        return {
          secret: cfg.jwtSecret,
          signOptions: {
            issuer: cfg.jwtIssuer,
            // `ms` expects a branded StringValue; the env value is a plain string.
            expiresIn: cfg.jwtAccessTtl,
          },
        } as unknown as JwtModuleOptions;
      },
    }),
  ],
  providers: [AuthService, PasswordHasher, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
