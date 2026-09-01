import { GameCategory } from '@prisma/client';
import { GamesService } from './games.service';

describe('GamesService', () => {
  const prisma = { game: { findMany: jest.fn() } };
  let service: GamesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GamesService(prisma as never);
  });

  it('returns an empty catalog without error', async () => {
    prisma.game.findMany.mockResolvedValue([]);
    await expect(service.list()).resolves.toEqual([]);
  });

  it('accepts a category filter when the catalog is empty', async () => {
    prisma.game.findMany.mockResolvedValue([]);
    await expect(service.list(GameCategory.EMOTIONS)).resolves.toEqual([]);
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: GameCategory.EMOTIONS }),
      }),
    );
  });
});
