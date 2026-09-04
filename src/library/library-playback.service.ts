import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogStatus,
  ChildActivityType,
  LibraryPlaybackStatus,
} from '@prisma/client';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  LibraryPlaybackDto,
  StartLibraryPlaybackDto,
} from './dto/library-playback.dto';

@Injectable()
export class LibraryPlaybackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
  ) {}

  async start(
    responsibleId: string,
    childId: string,
    contentId: string,
    dto: StartLibraryPlaybackDto,
  ): Promise<LibraryPlaybackDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const content = await this.prisma.libraryContent.findFirst({
      where: { id: contentId, status: CatalogStatus.AVAILABLE },
      select: { id: true },
    });
    if (!content) throw new NotFoundException('Library content not found');

    return this.prisma.$transaction(async (tx) => {
      const playback = await tx.libraryPlayback.upsert({
        where: { clientSessionId: dto.clientSessionId },
        create: {
          childId,
          libraryContentId: contentId,
          clientSessionId: dto.clientSessionId,
          status: LibraryPlaybackStatus.STARTED,
          startedAt: new Date(),
        },
        update: {},
        include: { libraryContent: { select: { type: true } } },
      });

      if (playback.childId !== childId) {
        throw new ConflictException('Playback session belongs to another child');
      }
      if (playback.libraryContentId !== contentId) {
        throw new ConflictException('Playback session belongs to another content');
      }

      await tx.childActivityEvent.upsert({
        where: {
          libraryPlaybackId_type: {
            libraryPlaybackId: playback.id,
            type: ChildActivityType.LIBRARY_STARTED,
          },
        },
        create: {
          childId,
          type: ChildActivityType.LIBRARY_STARTED,
          occurredAt: playback.startedAt,
          libraryPlaybackId: playback.id,
        },
        update: {},
      });

      return this.toDto(playback);
    });
  }

  async complete(
    responsibleId: string,
    childId: string,
    playbackId: string,
  ): Promise<LibraryPlaybackDto> {
    await this.childrenService.getOwned(responsibleId, childId);

    return this.prisma.$transaction(async (tx) => {
      let playback = await tx.libraryPlayback.findFirst({
        where: { id: playbackId, childId },
        include: { libraryContent: { select: { type: true } } },
      });
      if (!playback) throw new NotFoundException('Library playback not found');

      if (playback.status === LibraryPlaybackStatus.STARTED) {
        const completionTime = new Date();
        await tx.libraryPlayback.updateMany({
          where: {
            id: playbackId,
            childId,
            status: LibraryPlaybackStatus.STARTED,
            completedAt: null,
          },
          data: {
            status: LibraryPlaybackStatus.COMPLETED,
            completedAt: completionTime,
          },
        });
        playback = await tx.libraryPlayback.findFirst({
          where: { id: playbackId, childId },
          include: { libraryContent: { select: { type: true } } },
        });
        if (!playback) throw new NotFoundException('Library playback not found');
      }

      if (!playback.completedAt) {
        throw new ConflictException('Library playback is not completable');
      }

      await tx.childActivityEvent.upsert({
        where: {
          libraryPlaybackId_type: {
            libraryPlaybackId: playback.id,
            type: ChildActivityType.LIBRARY_COMPLETED,
          },
        },
        create: {
          childId,
          type: ChildActivityType.LIBRARY_COMPLETED,
          occurredAt: playback.completedAt,
          libraryPlaybackId: playback.id,
        },
        update: {},
      });

      return this.toDto(playback);
    });
  }

  private toDto(playback: {
    id: string;
    libraryContentId: string;
    clientSessionId: string;
    status: LibraryPlaybackStatus;
    startedAt: Date;
    completedAt: Date | null;
    lastPositionMs: number | null;
    consumedDurationMs: number | null;
    libraryContent: { type: LibraryPlaybackDto['contentType'] };
  }): LibraryPlaybackDto {
    return {
      id: playback.id,
      contentId: playback.libraryContentId,
      clientSessionId: playback.clientSessionId,
      status: playback.status,
      contentType: playback.libraryContent.type,
      startedAt: playback.startedAt,
      completedAt: playback.completedAt,
      lastPositionMs: playback.lastPositionMs,
      consumedDurationMs: playback.consumedDurationMs,
    };
  }
}
