import { PrismaClient } from '@prisma/client';
import { LIBRARY_MUSIC_CATALOG } from './library-music-catalog';

/**
 * Registers catalog metadata only. Entries intentionally remain COMING_SOON
 * until the post-upload publish command verifies both R2 objects.
 */
export async function seedLibraryMusic(prisma: PrismaClient): Promise<number> {
  for (const item of LIBRARY_MUSIC_CATALOG) {
    await prisma.libraryContent.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        type: item.type,
        mediaFormat: item.mediaFormat,
        mimeType: item.mimeType,
        storageKey: item.storageKey,
        thumbnailStorageKey: item.thumbnailStorageKey,
        theme: item.theme,
        displayOrder: item.sortOrder,
        // Preserve a status published by the explicit R2 verification command.
        // Fresh records below always begin as COMING_SOON.
      },
      create: {
        code: item.code,
        title: item.title,
        type: item.type,
        mediaFormat: item.mediaFormat,
        mimeType: item.mimeType,
        storageKey: item.storageKey,
        thumbnailStorageKey: item.thumbnailStorageKey,
        theme: item.theme,
        displayOrder: item.sortOrder,
        status: item.status,
      },
    });
  }

  return LIBRARY_MUSIC_CATALOG.length;
}
