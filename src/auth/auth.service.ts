import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Responsible, Language } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import type { AppConfig } from 'src/config/app.config';
import { PasswordHasher } from './password-hasher';
import type { RegisterDto } from './dto/register.dto';
import type { ResponsiblePublicDto } from './dto/register.dto';
type ResponsibleWithPublic = Pick<
  Responsible,
  'id' | 'email' | 'language' | 'termsAcceptedAt' | 'createdAt' | 'updatedAt'
>;

function toPublic(r: ResponsibleWithPublic): ResponsiblePublicDto {
  return {
    id: r.id,
    email: r.email,
    language: r.language,
    termsAcceptedAt: r.termsAcceptedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private cfg(): AppConfig {
    return this.config.get<AppConfig>('app')!;
  }

  async register(dto: RegisterDto): Promise<ResponsiblePublicDto> {
    // DTO already enforces termsAccepted === true, but keep a defensive check.
    if (!dto.termsAccepted) {
      throw new UnauthorizedException('Terms must be accepted to register');
    }

    const passwordHash = await this.hasher.hash(dto.password);

    const created = await this.prisma.responsible.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        language: dto.language as Language,
        termsAcceptedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        language: true,
        termsAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return toPublic(created);
  }

  /** Returns the principal if credentials are valid, otherwise null. */
  async validateUser(email: string, password: string): Promise<ResponsiblePublicDto | null> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        language: true,
        termsAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    if (!responsible) {
      return null;
    }
    const ok = await this.hasher.verify(responsible.passwordHash, password);
    if (!ok) {
      return null;
    }
    const { passwordHash: _omit, ...rest } = responsible;
    return toPublic(rest);
  }

  async login(user: ResponsiblePublicDto): Promise<{ accessToken: string; user: ResponsiblePublicDto }> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(
      payload,
      {
        issuer: this.cfg().jwtIssuer,
        // `ms` expects a branded StringValue; the env value is a plain string.
        expiresIn: this.cfg().jwtAccessTtl,
      } as unknown as Parameters<typeof this.jwtService.signAsync>[1],
    );
    return { accessToken, user };
  }
}
