import { Injectable } from '@nestjs/common';
import { CatalogStatus, LibraryContentType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { R2StorageService } from 'src/storage/r2-storage.service';
import type { LibraryContentDto } from './dto/library-content.dto';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
  ) {}

  async list(type?: LibraryContentType): Promise<LibraryContentDto[]> {
    const content = await this.prisma.libraryContent.findMany({
      where: { status: CatalogStatus.AVAILABLE, ...(type ? { type } : {}) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(
      content.map(async (item) => ({
        id: item.id,
        code: item.code,
        type: item.type,
        title: item.title,
        mediaFormat: item.mediaFormat,
        mimeType: item.mimeType,
        thumbnailUrl: item.thumbnailStorageKey
          ? await this.storage.getReadUrl(item.thumbnailStorageKey)
          : null,
        mediaUrl: item.storageKey ? await this.storage.getReadUrl(item.storageKey) : null,
        durationSeconds: item.durationSeconds,
        theme: item.theme,
        status: item.status,
        displayOrder: item.displayOrder,
      })),
    );
  }
}
