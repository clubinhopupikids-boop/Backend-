import {
  CatalogStatus,
  LibraryContentType,
  LibraryMediaFormat,
  LibraryTheme,
} from '@prisma/client';
import { LibraryService } from './library.service';

describe('LibraryService', () => {
  const prisma = { libraryContent: { findMany: jest.fn() } };
  const storage = { getReadUrl: jest.fn() };
  let service: LibraryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LibraryService(prisma as never, storage as never);
  });

  it('keeps empty catalog types valid and only asks Prisma for AVAILABLE content', async () => {
    prisma.libraryContent.findMany.mockResolvedValue([]);

    await expect(service.list(LibraryContentType.MUSIC)).resolves.toEqual([]);
    expect(prisma.libraryContent.findMany).toHaveBeenCalledWith({
      where: { status: CatalogStatus.AVAILABLE, type: LibraryContentType.MUSIC },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('preserves catalog sort order and resolves storage keys into URLs only in the DTO', async () => {
    prisma.libraryContent.findMany.mockResolvedValue([
      {
        id: 'music-1',
        code: 'music_i_can_do_it',
        type: LibraryContentType.MUSIC,
        title: 'Eu Consigo!',
        mediaFormat: LibraryMediaFormat.VIDEO,
        mimeType: 'video/mp4',
        storageKey: 'library/music/eu-consigo/video.mp4',
        thumbnailStorageKey: 'library/music/eu-consigo/thumbnail.webp',
        durationSeconds: 151,
        theme: LibraryTheme.DEVELOPMENT,
        status: CatalogStatus.AVAILABLE,
        displayOrder: 14,
      },
    ]);
    storage.getReadUrl
      .mockResolvedValueOnce('https://signed.example/thumbnail')
      .mockResolvedValueOnce('https://signed.example/video');

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        code: 'music_i_can_do_it',
        mediaUrl: 'https://signed.example/video',
        thumbnailUrl: 'https://signed.example/thumbnail',
        mediaFormat: LibraryMediaFormat.VIDEO,
      }),
    ]);
    const serialized = JSON.stringify((await service.list()) ?? []);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('thumbnailStorageKey');
  });
});
