import { Injectable } from '@nestjs/common';

export interface SelectableMission {
  id: string;
  exclusionGroup: string | null;
}

@Injectable()
export class MissionRandom {
  next(): number {
    return Math.random();
  }
}

@Injectable()
export class MissionSelectionService {
  constructor(private readonly random: MissionRandom) {}

  select(
    candidates: SelectableMission[],
    previousIds: Set<string>,
    previousGroups: Set<string>,
    limit: number,
  ): SelectableMission[] {
    const remaining = [...candidates];
    const selected: SelectableMission[] = [];
    const selectedGroups = new Set<string>();
    while (remaining.length > 0 && selected.length < limit) {
      const eligible = remaining.filter(
        (m) => !m.exclusionGroup || !selectedGroups.has(m.exclusionGroup),
      );
      if (eligible.length === 0) break;
      const groups = [0, 1, 2, 3].map((rank) =>
        eligible.filter((m) => this.rank(m, previousIds, previousGroups) === rank),
      );
      const best = groups.find((group) => group.length > 0)!;
      const index = Math.min(best.length - 1, Math.floor(this.random.next() * best.length));
      const picked = best[index];
      selected.push(picked);
      if (picked.exclusionGroup) selectedGroups.add(picked.exclusionGroup);
      remaining.splice(
        remaining.findIndex((m) => m.id === picked.id),
        1,
      );
    }
    return selected;
  }

  private rank(
    mission: SelectableMission,
    previousIds: Set<string>,
    previousGroups: Set<string>,
  ): number {
    const repeated = previousIds.has(mission.id);
    const groupRepeated = mission.exclusionGroup
      ? previousGroups.has(mission.exclusionGroup)
      : false;
    if (!repeated && !groupRepeated) return 0;
    if (!repeated) return 1;
    if (!groupRepeated) return 2;
    return 3;
  }
}
