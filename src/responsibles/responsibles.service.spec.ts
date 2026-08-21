import { NotFoundException } from '@nestjs/common';
import { Language } from '@prisma/client';
import { ResponsiblesService } from './responsibles.service';

describe('ResponsiblesService', () => {
  let service: ResponsiblesService;
  let prisma: { responsible: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { responsible: { findUnique: jest.fn() } };
    service = new ResponsiblesService(prisma as unknown as never);
  });

  it('returns the public DTO without passwordHash', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      id: 'r1',
      email: 'parent@example.com',
      language: Language.PT_BR,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.findById('r1');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.email).toBe('parent@example.com');
  });

  it('throws NotFound when responsible does not exist', async () => {
    prisma.responsible.findUnique.mockResolvedValue(null);
    await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('selects only safe fields (no passwordHash)', async () => {
    prisma.responsible.findUnique.mockResolvedValue({
      id: 'r1',
      email: 'parent@example.com',
      language: Language.PT_BR,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.findById('r1');
    const select = prisma.responsible.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('passwordHash');
    expect(select.id).toBe(true);
    expect(select.email).toBe(true);
  });
});
