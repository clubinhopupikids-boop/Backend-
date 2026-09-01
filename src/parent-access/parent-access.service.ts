import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from 'src/config/app.config';
import { PasswordHasher } from 'src/auth/password-hasher';
import { PrismaService } from 'src/database/prisma.service';
import type { ParentAccessGrantDto, ParentAccessStatusDto } from './dto/parent-access.dto';
import { ParentAccessTokenService } from './parent-access-token.service';

@Injectable()
export class ParentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: ParentAccessTokenService,
    private readonly config: ConfigService,
  ) {}

  private cfg(): AppConfig {
    return this.config.get<AppConfig>('app')!;
  }

  async status(responsibleId: string): Promise<ParentAccessStatusDto> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { id: responsibleId },
      select: { parentPinHash: true },
    });
    if (!responsible) throw new NotFoundException('Account not found');
    return { hasPin: responsible.parentPinHash !== null };
  }

  async verifyPassword(responsibleId: string, password: string): Promise<ParentAccessGrantDto> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { id: responsibleId },
      select: { passwordHash: true, parentPinHash: true },
    });
    if (!responsible || !(await this.hasher.verify(responsible.passwordHash, password))) {
      throw new UnauthorizedException('Invalid account password');
    }
    return {
      ...(await this.tokens.issue(responsibleId)),
      hasPin: responsible.parentPinHash !== null,
    };
  }

  async verifyPin(responsibleId: string, pin: string): Promise<ParentAccessGrantDto> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { id: responsibleId },
      select: {
        parentPinHash: true,
        parentPinLockedUntil: true,
      },
    });
    if (!responsible) throw new NotFoundException('Account not found');
    if (!responsible.parentPinHash) {
      throw new BadRequestException('Parent PIN is not configured');
    }

    const now = new Date();
    if (responsible.parentPinLockedUntil && responsible.parentPinLockedUntil > now) {
      this.throwPinLocked(responsible.parentPinLockedUntil, now);
    }

    if (await this.hasher.verify(responsible.parentPinHash, pin)) {
      await this.prisma.responsible.update({
        where: { id: responsibleId },
        data: { parentPinFailedAttempts: 0, parentPinLockedUntil: null },
      });
      return { ...(await this.tokens.issue(responsibleId)), hasPin: true };
    }

    const failed = await this.prisma.responsible.update({
      where: { id: responsibleId },
      data: { parentPinFailedAttempts: { increment: 1 } },
      select: { parentPinFailedAttempts: true },
    });
    const pinPolicy = this.cfg().parentPin;
    if (failed.parentPinFailedAttempts >= pinPolicy.maxAttempts) {
      const lockedUntil = new Date(now.getTime() + pinPolicy.lockSeconds * 1000);
      await this.prisma.responsible.update({
        where: { id: responsibleId },
        data: { parentPinFailedAttempts: 0, parentPinLockedUntil: lockedUntil },
      });
      this.throwPinLocked(lockedUntil, now);
    }
    if (failed.parentPinFailedAttempts >= pinPolicy.delayAfterAttempts && pinPolicy.delayMs > 0) {
      await delay(pinPolicy.delayMs);
    }
    throw new UnauthorizedException('Invalid parent PIN');
  }

  async setPin(responsibleId: string, pin: string): Promise<ParentAccessStatusDto> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { id: responsibleId },
      select: { parentPinCreatedAt: true },
    });
    if (!responsible) throw new NotFoundException('Account not found');

    const now = new Date();
    const parentPinHash = await this.hasher.hash(pin);
    await this.prisma.responsible.update({
      where: { id: responsibleId },
      data: {
        parentPinHash,
        parentPinCreatedAt: responsible.parentPinCreatedAt ?? now,
        parentPinUpdatedAt: now,
        parentPinFailedAttempts: 0,
        parentPinLockedUntil: null,
      },
    });
    return { hasPin: true };
  }

  async removePin(responsibleId: string): Promise<ParentAccessStatusDto> {
    await this.prisma.responsible.update({
      where: { id: responsibleId },
      data: {
        parentPinHash: null,
        parentPinCreatedAt: null,
        parentPinUpdatedAt: null,
        parentPinFailedAttempts: 0,
        parentPinLockedUntil: null,
      },
    });
    return { hasPin: false };
  }

  private throwPinLocked(lockedUntil: Date, now: Date): never {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
    );
    throw new HttpException(
      { message: 'Parent PIN temporarily unavailable', retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
