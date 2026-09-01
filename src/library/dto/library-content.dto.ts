import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CatalogStatus,
  LibraryContentType,
  LibraryMediaFormat,
  LibraryTheme,
} from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class LibraryContentQueryDto {
  @ApiPropertyOptional({ enum: LibraryContentType })
  @IsOptional()
  @IsEnum(LibraryContentType)
  type?: LibraryContentType;
}

export class LibraryContentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: LibraryContentType })
  type!: LibraryContentType;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ enum: LibraryMediaFormat, nullable: true })
  mediaFormat!: LibraryMediaFormat | null;

  @ApiPropertyOptional({ nullable: true, example: 'video/mp4' })
  mimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mediaUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  durationSeconds!: number | null;

  @ApiPropertyOptional({ enum: LibraryTheme, nullable: true })
  theme!: LibraryTheme | null;

  @ApiProperty({ enum: CatalogStatus })
  status!: CatalogStatus;

  @ApiProperty({ minimum: 0 })
  displayOrder!: number;
}
