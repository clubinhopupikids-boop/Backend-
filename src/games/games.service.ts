import { Injectable } from '@nestjs/common';
import { GameCategory } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import type { GameCatalogItemDto } from './dto/game.dto';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: GameCategory): Promise<GameCatalogItemDto[]> {
    const games = await this.prisma.game.findMany({
      where: category ? { category } : {},
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return games.map((game) => ({
      id: game.id,
      title: game.title,
      category: game.category,
      coverUrl: game.coverUrl,
      starReward: game.starReward,
      crystalReward: game.crystalReward,
      status: game.status,
      displayOrder: game.displayOrder,
    }));
  }
}
