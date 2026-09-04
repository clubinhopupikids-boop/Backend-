import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FamilyNotesService } from './family-notes.service';

describe('FamilyNotesService', () => {
  const prisma = {
    familyNote: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const childrenService = { getOwned: jest.fn() };
  const service = new FamilyNotesService(prisma as never, childrenService as never);
  const note = {
    id: 'note-1',
    responsibleId: 'responsible-1',
    childId: 'child-1',
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    text: 'Um momento importante.',
    observedAt: new Date('2026-09-02T15:00:00.000Z'),
    createdAt: new Date('2026-09-02T15:01:00.000Z'),
    updatedAt: new Date('2026-09-02T15:01:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
  });

  it('creates a trimmed note for a child owned by the responsible', async () => {
    prisma.familyNote.upsert.mockResolvedValue(note);

    await expect(
      service.create('responsible-1', 'child-1', {
        text: '  Um momento importante.  ',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
        observedAt: '2026-09-02T15:00:00.000Z',
      }),
    ).resolves.toMatchObject({ id: 'note-1', childId: 'child-1' });

    expect(childrenService.getOwned).toHaveBeenCalledWith('responsible-1', 'child-1');
    expect(prisma.familyNote.upsert).toHaveBeenCalledWith({
      where: {
        responsibleId_childId_clientRequestId: {
          responsibleId: 'responsible-1',
          childId: 'child-1',
          clientRequestId: '11111111-1111-4111-8111-111111111111',
        },
      },
      create: {
        responsibleId: 'responsible-1',
        childId: 'child-1',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
        text: 'Um momento importante.',
        observedAt: new Date('2026-09-02T15:00:00.000Z'),
      },
      update: {},
    });
  });

  it('lists owned notes in stable descending order', async () => {
    prisma.familyNote.findMany.mockResolvedValue([note]);

    await expect(service.list('responsible-1', 'child-1', {})).resolves.toHaveLength(1);
    expect(prisma.familyNote.findMany).toHaveBeenCalledWith({
      where: { responsibleId: 'responsible-1', childId: 'child-1' },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  });

  it('filters notes using inclusive from and exclusive to', async () => {
    prisma.familyNote.findMany.mockResolvedValue([]);

    await service.list('responsible-1', 'child-1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(prisma.familyNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          observedAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-10-01T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects an invalid period', async () => {
    await expect(
      service.list('responsible-1', 'child-1', {
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('edits only the note matching note, child and authenticated responsible', async () => {
    prisma.familyNote.updateMany.mockResolvedValue({ count: 1 });
    prisma.familyNote.findUniqueOrThrow.mockResolvedValue({ ...note, text: 'Atualizada' });

    await expect(
      service.update('responsible-1', 'child-1', 'note-1', { text: ' Atualizada ' }),
    ).resolves.toMatchObject({ text: 'Atualizada' });
    expect(prisma.familyNote.updateMany).toHaveBeenCalledWith({
      where: { id: 'note-1', childId: 'child-1', responsibleId: 'responsible-1' },
      data: { text: 'Atualizada' },
    });
  });

  it('deletes only the note matching note, child and authenticated responsible', async () => {
    prisma.familyNote.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.delete('responsible-1', 'child-1', 'note-1')).resolves.toBeUndefined();
    expect(prisma.familyNote.deleteMany).toHaveBeenCalledWith({
      where: { id: 'note-1', childId: 'child-1', responsibleId: 'responsible-1' },
    });
  });

  it('rejects empty text after trimming', async () => {
    await expect(
      service.create('responsible-1', 'child-1', {
        text: '   ',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.familyNote.upsert).not.toHaveBeenCalled();
  });

  it('denies a child from another family before reading or writing notes', async () => {
    childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));

    await expect(service.list('responsible-2', 'child-1', {})).rejects.toThrow('Child not found');
    expect(prisma.familyNote.findMany).not.toHaveBeenCalled();
  });

  it('does not reveal a note belonging to another family', async () => {
    prisma.familyNote.updateMany.mockResolvedValue({ count: 0 });
    prisma.familyNote.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('responsible-1', 'child-1', 'note-from-other-family', { text: 'Texto' }),
    ).rejects.toThrow('Family note not found');
    await expect(
      service.delete('responsible-1', 'child-1', 'note-from-other-family'),
    ).rejects.toThrow('Family note not found');
  });
});
