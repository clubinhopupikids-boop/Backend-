import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { PasswordHasher } from 'src/auth/password-hasher';
import { ParentAccessService } from './parent-access.service';
import { ParentAccessTokenService } from './parent-access-token.service';

describe('ParentAccessService', () => {
  let service: ParentAccessService;
  let prisma: {
    responsible: { findUnique: jest.Mock; update: jest.Mock };
  };
  let hasher: { hash: jest.Mock; verify: jest.Mock };
  let tokens: { issue: jest.Mock };

  beforeEach(() => {
    prisma = {
      responsible: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('argon2-parent-pin-hash'),
      verify: jest.fn(),
    };
    tokens = {
      issue: jest.fn().mockResolvedValue({
        parentAccessToken: 'parent-ticket',
        expiresInSeconds: 900,
      }),
    };
    const config = {
      get: jest.fn().mockReturnValue({
        parentPin: {
          maxAttempts: 5,
          delayAfterAttempts: 3,
          delayMs: 0,
          lockSeconds: 300,
        },
      }),
    };
    service = new ParentAccessService(
      prisma as never,
      hasher as unknown as PasswordHasher,
      tokens as unknown as ParentAccessTokenService,
      config as unknown as ConfigService,
    );
  });

  it('reports only that an account has no PIN', async () => {
    prisma.responsible.findUnique.mockResolvedValue({ parentPinHash: null });

    await expect(service.status('responsible-a')).resolves.toEqual({ hasPin: false });

    const select = prisma.responsible.findUnique.mock.calls[0][0].select;
    expect(select).toEqual({ parentPinHash: true });
    expect(JSON.stringify(await service.status('responsible-a'))).not.toContain('Hash');
  });

  it('issues parent access when the account password is correct', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      passwordHash: 'account-password-hash',
      parentPinHash: null,
    });
    hasher.verify.mockResolvedValue(true);

    await expect(service.verifyPassword('responsible-a', 'correct-password')).resolves.toEqual({
      parentAccessToken: 'parent-ticket',
      expiresInSeconds: 900,
      hasPin: false,
    });
    expect(hasher.verify).toHaveBeenCalledWith('account-password-hash', 'correct-password');
    expect(tokens.issue).toHaveBeenCalledWith('responsible-a');
  });

  it('does not issue parent access when the account password is wrong', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      passwordHash: 'account-password-hash',
      parentPinHash: null,
    });
    hasher.verify.mockResolvedValue(false);

    await expect(service.verifyPassword('responsible-a', 'wrong-password')).rejects.toThrow(
      'Invalid account password',
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('issues parent access and clears failures when the PIN is correct', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      parentPinHash: 'pin-hash',
      parentPinLockedUntil: null,
    });
    hasher.verify.mockResolvedValue(true);
    prisma.responsible.update.mockResolvedValue({});

    await expect(service.verifyPin('responsible-a', '123456')).resolves.toEqual({
      parentAccessToken: 'parent-ticket',
      expiresInSeconds: 900,
      hasPin: true,
    });
    expect(hasher.verify).toHaveBeenCalledWith('pin-hash', '123456');
    expect(prisma.responsible.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { parentPinFailedAttempts: 0, parentPinLockedUntil: null },
      }),
    );
  });

  it('does not issue parent access when the PIN is incorrect', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      parentPinHash: 'pin-hash',
      parentPinLockedUntil: null,
    });
    hasher.verify.mockResolvedValue(false);
    prisma.responsible.update.mockResolvedValue({ parentPinFailedAttempts: 1 });

    await expect(service.verifyPin('responsible-a', '000000')).rejects.toThrow(
      'Invalid parent PIN',
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('requires password flow when no PIN is configured', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      parentPinHash: null,
      parentPinLockedUntil: null,
    });

    await expect(service.verifyPin('responsible-a', '123456')).rejects.toThrow(
      'Parent PIN is not configured',
    );
    expect(hasher.verify).not.toHaveBeenCalled();
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('temporarily locks only PIN verification after repeated failures', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      parentPinHash: 'pin-hash',
      parentPinLockedUntil: null,
    });
    hasher.verify.mockResolvedValue(false);
    prisma.responsible.update
      .mockResolvedValueOnce({ parentPinFailedAttempts: 5 })
      .mockResolvedValueOnce({});

    const error = await service.verifyPin('responsible-a', '000000').catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('hashes a new PIN and never writes plaintext', async () => {
    prisma.responsible.findUnique.mockResolvedValue({ parentPinCreatedAt: null });
    prisma.responsible.update.mockResolvedValue({});

    await expect(service.setPin('responsible-a', '654321')).resolves.toEqual({ hasPin: true });

    expect(hasher.hash).toHaveBeenCalledWith('654321');
    const data = prisma.responsible.update.mock.calls[0][0].data;
    expect(data.parentPinHash).toBe('argon2-parent-pin-hash');
    expect(JSON.stringify(data)).not.toContain('654321');
  });
});
