import { Language } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ChildrenService } from './children.service';
import type { CreateChildDto, UpdateChildDto } from './dto/child.dto';

describe('ChildrenService', () => {
  let service: ChildrenService;
  let prisma: {
    child: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    experienceSettings: { create: jest.Mock };
    communicationMode: { findMany: jest.Mock };
    childCommunicationMode: { createMany: jest.Mock };
  };

  const ownChild = {
    id: 'c1',
    responsibleId: 'r1',
    name: 'Luna',
    birthDate: new Date(2020, 5, 15),
    primaryLanguage: Language.PT_BR,
    developmentProfile: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const transactionClient = (
    child = ownChild,
    modes: { id: string; code: string; label: string }[] = [],
  ) => ({
    child: { create: jest.fn().mockResolvedValue(child) },
    experienceSettings: { create: jest.fn().mockResolvedValue({}) },
    communicationMode: { findMany: jest.fn().mockResolvedValue(modes) },
    childCommunicationMode: { createMany: jest.fn().mockResolvedValue({ count: modes.length }) },
  });

  beforeEach(() => {
    prisma = {
      child: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      experienceSettings: { create: jest.fn() },
      communicationMode: { findMany: jest.fn() },
      childCommunicationMode: { createMany: jest.fn() },
    };
    service = new ChildrenService(prisma as unknown as never);
  });

  describe('list', () => {
    it('queries children scoped to the responsible', async () => {
      prisma.child.findMany.mockResolvedValue([ownChild]);
      await service.list('r1');
      expect(prisma.child.findMany.mock.calls[0][0].where).toEqual({ responsibleId: 'r1' });
    });

    it('returns DTOs with birthDate and no persisted age', async () => {
      prisma.child.findMany.mockResolvedValue([ownChild]);
      const result = await service.list('r1');
      expect(result[0]).toHaveProperty('birthDate');
      expect(result[0]).not.toHaveProperty('age');
      expect(result[0]).not.toHaveProperty('responsibleId');
    });
  });

  describe('getOwned', () => {
    it('returns the child when it belongs to the responsible', async () => {
      prisma.child.findFirst.mockResolvedValue(ownChild);
      const child = await service.getOwned('r1', 'c1');
      expect(child.id).toBe('c1');
      expect(prisma.child.findFirst.mock.calls[0][0].where).toEqual({
        id: 'c1',
        responsibleId: 'r1',
      });
    });

    it('throws NotFound when the child belongs to another responsible', async () => {
      prisma.child.findFirst.mockResolvedValue(null);
      await expect(service.getOwned('r2', 'c1')).rejects.toThrow('Child not found');
      expect(prisma.child.findFirst.mock.calls[0][0].where).toEqual({
        id: 'c1',
        responsibleId: 'r2',
      });
    });
  });

  describe('create', () => {
    it('persists a simple child and finds it again in a new session query', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          child: { create: jest.fn().mockResolvedValue(ownChild) },
          experienceSettings: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const dto: CreateChildDto = {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
      };
      const result = await service.create('r1', dto);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveProperty('birthDate', '2020-06-15');
      expect(result).not.toHaveProperty('age');

      prisma.child.findMany.mockResolvedValue([ownChild]);
      const afterNewLogin = await service.list('r1');
      expect(afterNewLogin.map((child) => child.name)).toContain('Luna');
      expect(prisma.child.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { responsibleId: 'r1' } }),
      );
    });

    it('rolls back if settings creation fails', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          child: { create: jest.fn().mockResolvedValue(ownChild) },
          experienceSettings: { create: jest.fn().mockRejectedValue(new Error('DB error')) },
        };
        return fn(tx);
      });

      const dto: CreateChildDto = {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
      };
      await expect(service.create('r1', dto)).rejects.toThrow('DB error');
    });

    it.each([
      ['TEA'],
      ['ADHD'],
      ['HIGH_ABILITIES_GIFTEDNESS'],
    ])('persists development profile %s', async (developmentProfile) => {
      let tx: ReturnType<typeof transactionClient> | undefined;
      prisma.$transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
        tx = transactionClient(ownChild);
        return fn(tx);
      });

      await service.create('r1', {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
        developmentProfile: developmentProfile as CreateChildDto['developmentProfile'],
      });

      expect(tx!.child.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ developmentProfile }),
      }));
    });

    it.each([
      ['VOICE', ['VOICE']],
      ['TEXT', ['TEXT']],
      ['IMAGES_SYMBOLS', ['IMAGES_SYMBOLS']],
      ['VOICE + TOUCH', ['VOICE', 'TOUCH']],
    ])('persists communication modes %s atomically with the child', async (_label, modeCodes) => {
      const modes = modeCodes.map((code, index) => ({ id: `m${index}`, code, label: code }));
      let tx: ReturnType<typeof transactionClient> | undefined;
      prisma.$transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
        tx = transactionClient(ownChild, modes);
        return fn(tx);
      });

      await service.create('r1', {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
        communicationModeCodes: modeCodes,
      });

      expect(tx!.childCommunicationMode.createMany).toHaveBeenCalledWith({
        data: modes.map((mode) => ({ childId: ownChild.id, communicationModeId: mode.id })),
      });
    });

    it('persists profile and communication in the same transaction', async () => {
      const modes = [{ id: 'm1', code: 'VOICE', label: 'Voice' }];
      let tx: ReturnType<typeof transactionClient> | undefined;
      prisma.$transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
        tx = transactionClient(ownChild, modes);
        return fn(tx);
      });

      await service.create('r1', {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
        developmentProfile: 'TEA' as CreateChildDto['developmentProfile'],
        communicationModeCodes: ['VOICE'],
      });

      expect(tx!.child.create).toHaveBeenCalled();
      expect(tx!.experienceSettings.create).toHaveBeenCalled();
      expect(tx!.childCommunicationMode.createMany).toHaveBeenCalled();
    });

    it('rejects an unknown communication code before creating a partial child', async () => {
      let tx: ReturnType<typeof transactionClient> | undefined;
      prisma.$transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
        tx = transactionClient(ownChild, []);
        return fn(tx);
      });

      await expect(service.create('r1', {
        name: 'Luna',
        birthDate: '2020-06-15',
        primaryLanguage: Language.PT_BR,
        communicationModeCodes: ['UNKNOWN'],
      })).rejects.toThrow(BadRequestException);

      expect(tx!.child.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('refuses to update a child not owned by the responsible', async () => {
      prisma.child.findFirst.mockResolvedValue(null);
      const dto: UpdateChildDto = { name: 'Updated' };
      await expect(service.update('r2', 'c1', dto)).rejects.toThrow('Child not found');
      expect(prisma.child.update).not.toHaveBeenCalled();
    });

    it('updates the child when owned', async () => {
      prisma.child.findFirst.mockResolvedValue(ownChild);
      prisma.child.update.mockResolvedValue({ ...ownChild, name: 'Updated' });
      const result = await service.update('r1', 'c1', { name: 'Updated' });
      expect(prisma.child.update.mock.calls[0][0].where).toEqual({ id: 'c1' });
      expect(result.name).toBe('Updated');
    });

    it('validates birthDate on update', async () => {
      prisma.child.findFirst.mockResolvedValue(ownChild);
      prisma.child.update.mockResolvedValue({ ...ownChild, birthDate: new Date(2019, 0, 1) });
      const result = await service.update('r1', 'c1', { birthDate: '2019-01-01' });
      expect(result.birthDate).toBe('2019-01-01');
    });
  });
});
