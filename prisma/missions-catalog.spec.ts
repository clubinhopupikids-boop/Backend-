import { MissionPeriod, MissionRarity } from '@prisma/client';
import { missionCatalog, normalMissionCatalog, rareMissionCatalog } from './missions-catalog';
import { seedMissions } from './seed-missions';

describe('approved mission catalog', () => {
  it('contains 59 normal missions in the definitive period pools and five inactive rares', () => {
    expect(normalMissionCatalog).toHaveLength(59);
    expect(normalMissionCatalog.filter((mission) => mission.period === MissionPeriod.DAILY)).toHaveLength(29);
    expect(normalMissionCatalog.filter((mission) => mission.period === MissionPeriod.WEEKLY)).toHaveLength(14);
    expect(normalMissionCatalog.filter((mission) => mission.period === MissionPeriod.MONTHLY)).toHaveLength(16);
    expect(rareMissionCatalog).toHaveLength(5);
    expect(rareMissionCatalog.every((mission) => mission.rarity === MissionRarity.RARE && !mission.isActive)).toBe(true);
  });

  it('does not include XP and maps rewards exclusively from each normal period', () => {
    for (const mission of normalMissionCatalog) {
      expect(mission).not.toHaveProperty('xp');
      if (mission.period === MissionPeriod.DAILY) expect(mission).toMatchObject({ starReward: 1, crystalReward: 0 });
      if (mission.period === MissionPeriod.WEEKLY) expect(mission).toMatchObject({ starReward: 3, crystalReward: 1 });
      if (mission.period === MissionPeriod.MONTHLY) expect(mission).toMatchObject({ starReward: 7, crystalReward: 5 });
    }
  });

  it('seeds every stable code idempotently through upsert', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    await expect(seedMissions({ mission: { upsert } } as never)).resolves.toBe(64);
    await expect(seedMissions({ mission: { upsert } } as never)).resolves.toBe(64);
    expect(upsert).toHaveBeenCalledTimes(missionCatalog.length * 2);
    expect(new Set(missionCatalog.map((mission) => mission.code)).size).toBe(64);
  });
});
