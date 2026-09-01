import type { PrismaClient } from '@prisma/client';
import { missionCatalog } from './missions-catalog';

/** Idempotently aligns the persisted mission catalog with the approved source data. */
export async function seedMissions(prisma: Pick<PrismaClient, 'mission'>): Promise<number> {
  for (const mission of missionCatalog) {
    const data = {
      title: mission.title,
      description: mission.description,
      period: mission.period,
      theme: mission.theme,
      iconKey: mission.iconKey,
      exclusionGroup: mission.exclusionGroup,
      rarity: mission.rarity,
      starReward: mission.starReward,
      crystalReward: mission.crystalReward,
      isActive: mission.isActive,
      displayOrder: mission.displayOrder,
    };
    await prisma.mission.upsert({
      where: { code: mission.code },
      update: data,
      create: { code: mission.code, ...data },
    });
  }
  return missionCatalog.length;
}
