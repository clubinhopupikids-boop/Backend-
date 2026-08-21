import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunicationPreferencesService } from './communication-preferences.service';
import { ChildrenService } from 'src/children/children.service';

describe('CommunicationPreferencesService', () => {
  let service: CommunicationPreferencesService;
  let prisma: {
    childCommunicationMode: { findMany: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
    communicationMode: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let childrenService: { getOwned: jest.Mock };

  const modes = [
    { id: 'm1', code: 'VOICE', label: 'Voice' },
    { id: 'm2', code: 'IMAGES_SYMBOLS', label: 'Images / Symbols' },
    { id: 'm3', code: 'TOUCH', label: 'Touch' },
  ];

  beforeEach(() => {
    prisma = {
      childCommunicationMode: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      communicationMode: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    childrenService = { getOwned: jest.fn() };
    service = new CommunicationPreferencesService(
      prisma as unknown as never,
      childrenService as unknown as ChildrenService,
    );
  });

  describe('list', () => {
    it('verifies ownership before listing', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.childCommunicationMode.findMany.mockResolvedValue([
        { mode: { code: 'VOICE', label: 'Voice' } },
      ]);

      await service.list('r1', 'c1');
      expect(childrenService.getOwned).toHaveBeenCalledWith('r1', 'c1');
    });

    it('throws NotFound when child is not owned', async () => {
      childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));
      await expect(service.list('r2', 'c1')).rejects.toThrow('Child not found');
    });

    it('returns mapped mode DTOs', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.childCommunicationMode.findMany.mockResolvedValue([
        { mode: { code: 'VOICE', label: 'Voice' } },
        { mode: { code: 'TOUCH', label: 'Touch' } },
      ]);

      const result = await service.list('r1', 'c1');
      expect(result).toEqual([
        { code: 'VOICE', label: 'Voice' },
        { code: 'TOUCH', label: 'Touch' },
      ]);
    });
  });

  describe('replace', () => {
    it('verifies ownership before replacing', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.communicationMode.findMany.mockResolvedValue([modes[0]]);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          childCommunicationMode: { deleteMany: jest.fn(), createMany: jest.fn() },
        };
        return fn(tx);
      });
      prisma.childCommunicationMode.findMany.mockResolvedValue([
        { mode: { code: 'VOICE', label: 'Voice' } },
      ]);

      await service.replace('r1', 'c1', ['VOICE']);
      expect(childrenService.getOwned).toHaveBeenCalledWith('r1', 'c1');
    });

    it('rejects unknown mode codes', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.communicationMode.findMany.mockResolvedValue([]);

      await expect(service.replace('r1', 'c1', ['UNKNOWN_CODE'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deduplicates mode codes before processing', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.communicationMode.findMany.mockResolvedValue([modes[0]]);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          childCommunicationMode: { deleteMany: jest.fn(), createMany: jest.fn() },
        };
        return fn(tx);
      });
      prisma.childCommunicationMode.findMany.mockResolvedValue([
        { mode: { code: 'VOICE', label: 'Voice' } },
      ]);

      await service.replace('r1', 'c1', ['VOICE', 'VOICE']);

      const findManyArgs = prisma.communicationMode.findMany.mock.calls[0][0];
      expect(findManyArgs.where.code.in).toEqual(['VOICE']);
    });

    it('clears all modes when empty array is sent', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          childCommunicationMode: { deleteMany: jest.fn(), createMany: jest.fn() },
        };
        return fn(tx);
      });
      prisma.childCommunicationMode.findMany.mockResolvedValue([]);

      await service.replace('r1', 'c1', []);

      expect(prisma.communicationMode.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFound when child is not owned', async () => {
      childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));
      await expect(service.replace('r2', 'c1', ['VOICE'])).rejects.toThrow('Child not found');
    });
  });
});
