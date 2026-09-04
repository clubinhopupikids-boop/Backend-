import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LibraryContentType, LibraryPlaybackStatus } from '@prisma/client';
import { IsUUID } from 'class-validator';

export class LibraryPlaybackContentParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contentId!: string;
}

export class LibraryPlaybackParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  playbackId!: string;
}

export class StartLibraryPlaybackDto {
  @ApiProperty({ format: 'uuid', description: 'Stable id for this player session' })
  @IsUUID()
  clientSessionId!: string;
}

export class LibraryPlaybackDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  contentId!: string;

  @ApiProperty({ format: 'uuid' })
  clientSessionId!: string;

  @ApiProperty({ enum: LibraryPlaybackStatus })
  status!: LibraryPlaybackStatus;

  @ApiProperty({ enum: LibraryContentType })
  contentType!: LibraryContentType;

  @ApiProperty({ format: 'date-time' })
  startedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  lastPositionMs!: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  consumedDurationMs!: number | null;
}
