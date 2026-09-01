import { Injectable } from '@nestjs/common';
import { MissionPeriod, MissionRarity, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { MissionClock } from './mission-clock.service';
import { CurrentMissionPeriod, MissionPeriodService } from './mission-period.service';
import { MissionSelectionService } from './mission-selection.service';

export const ASSIGNMENT_LIMITS: Record<MissionPeriod, number> = {
  [MissionPeriod.DAILY]: 5,
  [MissionPeriod.WEEKLY]: 5,
  [MissionPeriod.MONTHLY]: 7,
};

@Injectable()
export class MissionAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: MissionPeriodService,
    private readonly clock: MissionClock,
    private readonly selection: MissionSelectionService,
  ) {}

  async getOrCreate(childId: string, period: MissionPeriod, now = this.clock.now()) {
    return this.ensure(
      childId,
      this.periods.current(period, now),
      this.periods.previous(period, now),
    );
  }

  async ensure(childId: string, current: CurrentMissionPeriod, previous: CurrentMissionPeriod) {
    const existing = await this.findAssignments(childId, current);
    if (existing.length > 0) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const inside = await this.findAssignments(childId, current, tx);
        if (inside.length > 0) return inside;
        const [candidates, prior] = await Promise.all([
          tx.mission.findMany({
            where: { period: current.period, isActive: true, rarity: MissionRarity.NORMAL },
            orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
          }),
          this.findAssignments(childId, previous, tx),
        ]);
        const picked = this.selection.select(
          candidates,
          new Set(prior.map((assignment) => assignment.missionId)),
          new Set(
            prior
              .map((assignment) => assignment.mission.exclusionGroup)
              .filter((group): group is string => group !== null),
          ),
          ASSIGNMENT_LIMITS[current.period],
        );
        if (picked.length > 0) {
          await tx.missionAssignment.createMany({
            data: picked.map((mission, slot) => ({
              childId,
              missionId: mission.id,
              period: current.period,
              periodKey: current.key,
              slot,
            })),
          });
        }
        return this.findAssignments(childId, current, tx);
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      return this.findAssignments(childId, current);
    }
  }

  async ensureForDate(childId: string, period: MissionPeriod, localDate: Date) {
    const current = this.periods.forDate(period, localDate);
    const priorDate = new Date(localDate);
    if (period === MissionPeriod.DAILY) priorDate.setUTCDate(priorDate.getUTCDate() - 1);
    if (period === MissionPeriod.WEEKLY) priorDate.setUTCDate(priorDate.getUTCDate() - 7);
    if (period === MissionPeriod.MONTHLY) priorDate.setUTCMonth(priorDate.getUTCMonth() - 1, 1);
    return this.ensure(childId, current, this.periods.forDate(period, priorDate));
  }

  private findAssignments(
    childId: string,
    period: CurrentMissionPeriod,
    client: Pick<PrismaService, 'missionAssignment'> = this.prisma,
  ) {
    return client.missionAssignment.findMany({
      where: { childId, period: period.period, periodKey: period.key },
      include: { mission: true },
      orderBy: { slot: 'asc' },
    });
  }
}
