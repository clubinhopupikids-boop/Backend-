import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogStatus, GameCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class GameCatalogQueryDto {
  @ApiPropertyOptional({ enum: GameCategory })
  @IsOptional()
  @IsEnum(GameCategory)
  category?: GameCategory;
}

export class GameCatalogItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: GameCategory })
  category!: GameCategory;

  @ApiPropertyOptional({ nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ minimum: 0 })
  starReward!: number;

  @ApiProperty({ minimum: 0 })
  crystalReward!: number;

  @ApiProperty({ enum: CatalogStatus })
  status!: CatalogStatus;

  @ApiProperty({ minimum: 0 })
  displayOrder!: number;
}
