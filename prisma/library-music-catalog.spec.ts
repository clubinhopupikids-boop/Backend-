import { CatalogStatus, LibraryContentType, LibraryMediaFormat } from '@prisma/client';
import { LIBRARY_MUSIC_CATALOG } from './library-music-catalog';
import { seedLibraryMusic } from './seed-library-music';

describe('library music catalog', () => {
  it('contains exactly 18 unique MUSIC video clips with safe, unique storage keys', () => {
    expect(LIBRARY_MUSIC_CATALOG).toHaveLength(18);
    expect(new Set(LIBRARY_MUSIC_CATALOG.map((item) => item.code)).size).toBe(18);
    expect(new Set(LIBRARY_MUSIC_CATALOG.map((item) => item.slug)).size).toBe(18);
    expect(new Set(LIBRARY_MUSIC_CATALOG.map((item) => item.storageKey)).size).toBe(18);
    expect(new Set(LIBRARY_MUSIC_CATALOG.map((item) => item.thumbnailStorageKey)).size).toBe(18);
    expect(new Set(LIBRARY_MUSIC_CATALOG.map((item) => item.sortOrder)).size).toBe(18);
    expect(
      LIBRARY_MUSIC_CATALOG.filter((item) => item.thumbnailPercent !== undefined),
    ).toHaveLength(6);
    for (const item of LIBRARY_MUSIC_CATALOG) {
      expect(item.title).not.toHaveLength(0);
      expect(item.type).toBe(LibraryContentType.MUSIC);
      expect(item.mediaFormat).toBe(LibraryMediaFormat.VIDEO);
      expect(item.mimeType).toBe('video/mp4');
      expect(item.storageKey).toBe(`library/music/${item.slug}/video.mp4`);
      expect(item.thumbnailStorageKey).toBe(`library/music/${item.slug}/thumbnail.webp`);
      expect(item.status).toBe(CatalogStatus.COMING_SOON);
    }
  });

  it('uses code upserts and does not reset a published item on repeated seed', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    await expect(seedLibraryMusic({ libraryContent: { upsert } } as never)).resolves.toBe(18);
    expect(upsert).toHaveBeenCalledTimes(18);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'music_i_can_do_it' },
        update: expect.not.objectContaining({ status: expect.anything() }),
        create: expect.objectContaining({ status: CatalogStatus.COMING_SOON }),
      }),
    );
  });
});
