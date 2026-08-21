import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Language } from '@prisma/client';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import type { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let auth: AuthService;
  let prisma: { responsible: { findUnique: jest.Mock; create: jest.Mock } };
  let hasher: { hash: jest.Mock; verify: jest.Mock };
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock };

  const baseDto: RegisterDto = {
    email: 'parent@example.com',
    password: 'a-strong-password',
    language: Language.PT_BR,
    termsAccepted: true,
  };

  beforeEach(() => {
    prisma = { responsible: { findUnique: jest.fn(), create: jest.fn() } };
    hasher = { hash: jest.fn().mockResolvedValue('argon2-hash'), verify: jest.fn() };
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'app') {
          return {
            nodeEnv: 'development' as const,
            port: 3000,
            appPrefix: 'api',
            corsOrigins: ['*'],
            jwtSecret: 'x'.repeat(32),
            jwtAccessTtl: '1h',
            jwtIssuer: 'pupikids',
            databaseUrl: 'postgresql://x',
            swaggerPath: 'docs',
          };
        }
        return undefined;
      }),
    };
    auth = new AuthService(
      prisma as unknown as never,
      hasher as unknown as PasswordHasher,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('hashes the password and stores termsAcceptedAt when accepted', async () => {
      prisma.responsible.create.mockResolvedValue({
        id: 'r1',
        email: 'parent@example.com',
        language: Language.PT_BR,
        termsAcceptedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      const result = await auth.register(baseDto);

      expect(hasher.hash).toHaveBeenCalledWith('a-strong-password');
      const createArgs = prisma.responsible.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).toBe('argon2-hash');
      expect(createArgs.data.termsAcceptedAt).toBeInstanceOf(Date);
      expect(createArgs.data.email).toBe('parent@example.com');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('parent@example.com');
    });

    it('rejects registration when terms were not accepted', async () => {
      await expect(auth.register({ ...baseDto, termsAccepted: false })).rejects.toThrow(
        'Terms must be accepted to register',
      );
      expect(prisma.responsible.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns the public principal when credentials match', async () => {
      prisma.responsible.findUnique.mockResolvedValue({
        id: 'r1',
        email: 'parent@example.com',
        language: Language.PT_BR,
        termsAcceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'argon2-hash',
      });
      hasher.verify.mockResolvedValue(true);

      const user = await auth.validateUser('parent@example.com', 'a-strong-password');

      expect(user).not.toBeNull();
      expect(user?.id).toBe('r1');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('returns null when the account does not exist', async () => {
      prisma.responsible.findUnique.mockResolvedValue(null);
      const user = await auth.validateUser('nope@example.com', 'x');
      expect(user).toBeNull();
    });

    it('returns null when the password is wrong', async () => {
      prisma.responsible.findUnique.mockResolvedValue({
        id: 'r1',
        email: 'parent@example.com',
        language: Language.PT_BR,
        termsAcceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'argon2-hash',
      });
      hasher.verify.mockResolvedValue(false);
      const user = await auth.validateUser('parent@example.com', 'wrong');
      expect(user).toBeNull();
    });
  });

  describe('login', () => {
    it('issues a JWT containing only the responsible id and email', async () => {
      const user = {
        id: 'r1',
        email: 'parent@example.com',
        language: Language.PT_BR,
        termsAcceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await auth.login(user);
      expect(result.accessToken).toBe('jwt-token');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'r1', email: 'parent@example.com' },
        expect.objectContaining({ issuer: 'pupikids' }),
      );
      // Token payload must not contain sensitive data.
      const payload = jwt.signAsync.mock.calls[0][0];
      expect(Object.keys(payload).sort()).toEqual(['email', 'sub']);
    });
  });
});
