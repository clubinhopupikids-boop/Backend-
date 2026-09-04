import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CatalogStatus,
  ChildActivityType,
  LibraryContentType,
  LibraryPlaybackStatus,
} from '@prisma/client';
import { LibraryPlaybackService } from './library-playback.service';

describe('LibraryPlaybackService', () => {
  const prisma = {
    libraryContent: { findFirst: jest.fn() },
    libraryPlayback: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    childActivityEvent: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const childrenService = { getOwned: jest.fn() };
  const service = new LibraryPlaybackService(prisma as never, childrenService as never);

  const content = {
    id: 'content-1',
    type: LibraryContentType.STORIES,
  };
  const startedPlayback = {
    id: 'playback-1',
    childId: 'child-1',
    libraryContentId: 'content-1',
    clientSessionId: '11111111-1111-4111-8111-111111111111',
    status: LibraryPlaybackStatus.STARTED,
    startedAt: new Date('2026-09-04T12:00:00.000Z'),
    completedAt: null,
    lastPositionMs: null,
    consumedDurationMs: null,
    libraryContent: content,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
    prisma.libraryContent.findFirst.mockResolvedValue({ id: content.id });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.libraryPlayback.upsert.mockResolvedValue(startedPlayback);
    prisma.childActivityEvent.upsert.mockResolvedValue({ id: 'event-start' });
  });

  it('creates a canonical playback and one started projection after real playback is confirmed', async () => {
    const result = await service.start('responsible-1', 'child-1', 'content-1', {
      clientSessionId: startedPlayback.clientSessionId,
    });

    expect(result).toEqual({
      id: 'playback-1',
      contentId: 'content-1',
      clientSessionId: startedPlayback.clientSessionId,
      status: LibraryPlaybackStatus.STARTED,
      contentType: LibraryContentType.STORIES,
      startedAt: startedPlayback.startedAt,
      completedAt: null,
      lastPositionMs: null,
      consumedDurationMs: null,
    });
    expect(prisma.libraryContent.findFirst).toHaveBeenCalledWith({
      where: { id: 'content-1', status: CatalogStatus.AVAILABLE },
      select: { id: true },
    });
    expect(prisma.libraryPlayback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientSessionId: startedPlayback.clientSessionId },
        create: expect.objectContaining({
          childId: 'child-1',
          libraryContentId: 'content-1',
          clientSessionId: startedPlayback.clientSessionId,
          status: LibraryPlaybackStatus.STARTED,
        }),
      }),
    );
    expect(prisma.childActivityEvent.upsert).toHaveBeenCalledWith({
      where: {
        libraryPlaybackId_type: {
          libraryPlaybackId: 'playback-1',
          type: ChildActivityType.LIBRARY_STARTED,
        },
      },
      create: {
        childId: 'child-1',
        type: ChildActivityType.LIBRARY_STARTED,
        occurredAt: startedPlayback.startedAt,
        libraryPlaybackId: 'playback-1',
      },
      update: {},
    });
  });

  it('is idempotent for the same session and rejects reuse by another child or content', async () => {
    await service.start('responsible-1', 'child-1', 'content-1', {
      clientSessionId: startedPlayback.clientSessionId,
    });
    await service.start('responsible-1', 'child-1', 'content-1', {
      clientSessionId: startedPlayback.clientSessionId,
    });
    expect(prisma.libraryPlayback.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.childActivityEvent.upsert).toHaveBeenCalledTimes(2);

    prisma.libraryPlayback.upsert.mockResolvedValueOnce({
      ...startedPlayback,
      childId: 'child-2',
    });
    await expect(
      service.start('responsible-1', 'child-1', 'content-1', {
        clientSessionId: startedPlayback.clientSessionId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.libraryPlayback.upsert.mockResolvedValueOnce({
      ...startedPlayback,
      libraryContentId: 'content-2',
    });
    await expect(
      service.start('responsible-1', 'child-1', 'content-1', {
        clientSessionId: startedPlayback.clientSessionId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unavailable content and relies on normal child ownership', async () => {
    prisma.libraryContent.findFirst.mockResolvedValue(null);
    await expect(
      service.start('responsible-1', 'child-1', 'content-1', {
        clientSessionId: startedPlayback.clientSessionId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(childrenService.getOwned).toHaveBeenCalledWith('responsible-1', 'child-1');

    childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));
    await expect(
      service.start('responsible-2', 'child-1', 'content-1', {
        clientSessionId: startedPlayback.clientSessionId,
      }),
    ).rejects.toThrow('Child not found');
    expect(prisma.libraryContent.findFirst).toHaveBeenCalledTimes(1);
  });

  it('completes once and creates one completed projection', async () => {
    prisma.libraryPlayback.findFirst
      .mockResolvedValueOnce(startedPlayback)
      .mockResolvedValueOnce({
        ...startedPlayback,
        status: LibraryPlaybackStatus.COMPLETED,
        completedAt: new Date('2026-09-04T12:20:00.000Z'),
      });
    prisma.libraryPlayback.updateMany.mockResolvedValue({ count: 1 });
    prisma.childActivityEvent.upsert.mockResolvedValue({ id: 'event-completed' });

    const result = await service.complete('responsible-1', 'child-1', 'playback-1');

    expect(result.status).toBe(LibraryPlaybackStatus.COMPLETED);
    expect(result.completedAt).toEqual(new Date('2026-09-04T12:20:00.000Z'));
    expect(prisma.libraryPlayback.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'playback-1',
          childId: 'child-1',
          status: LibraryPlaybackStatus.STARTED,
          completedAt: null,
        },
        data: expect.objectContaining({ status: LibraryPlaybackStatus.COMPLETED }),
      }),
    );
    expect(prisma.childActivityEvent.upsert).toHaveBeenCalledWith({
      where: {
        libraryPlaybackId_type: {
          libraryPlaybackId: 'playback-1',
          type: ChildActivityType.LIBRARY_COMPLETED,
        },
      },
      create: {
        childId: 'child-1',
        type: ChildActivityType.LIBRARY_COMPLETED,
        occurredAt: new Date('2026-09-04T12:20:00.000Z'),
        libraryPlaybackId: 'playback-1',
      },
      update: {},
    });
  });

  it('does not update or duplicate completion on retry', async () => {
    const completed = {
      ...startedPlayback,
      status: LibraryPlaybackStatus.COMPLETED,
      completedAt: new Date('2026-09-04T12:20:00.000Z'),
    };
    prisma.libraryPlayback.findFirst.mockResolvedValue(completed);

    await service.complete('responsible-1', 'child-1', 'playback-1');
    await service.complete('responsible-1', 'child-1', 'playback-1');

    expect(prisma.libraryPlayback.updateMany).not.toHaveBeenCalled();
    expect(prisma.childActivityEvent.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not reveal a playback owned by another child', async () => {
    prisma.libraryPlayback.findFirst.mockResolvedValue(null);
    await expect(
      service.complete('responsible-1', 'child-1', 'playback-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.libraryPlayback.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'playback-2', childId: 'child-1' } }),
    );
  });
});
