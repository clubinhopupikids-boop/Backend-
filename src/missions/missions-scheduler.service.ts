import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MissionPeriod } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { MissionAssignmentService } from './mission-assignment.service';
import { MissionClock } from './mission-clock.service';
import { MissionPeriodService } from './mission-period.service';

@Injectable()
export class MissionsSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: MissionAssignmentService,
    private readonly periods: MissionPeriodService,
    private readonly clock: MissionClock,
  ) {}

  @Cron('59 59 23 * * *', { timeZone: process.env.MISSION_TIME_ZONE ?? 'America/Sao_Paulo' })
  async preGenerateNextCycles(): Promise<void> {
    await this.prepareNextCycles(this.clock.now());
  }

  async prepareNextCycles(now: Date): Promise<void> {
    const today = this.periods.localDate(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const children = await this.prisma.child.findMany({ select: { id: true } });
    await Promise.all(
      children.map(({ id }) => this.assignments.ensureForDate(id, MissionPeriod.DAILY, tomorrow)),
    );
    if (today.getUTCDay() === 6) {
      await Promise.all(
        children.map(({ id }) =>
          this.assignments.ensureForDate(id, MissionPeriod.WEEKLY, tomorrow),
        ),
      );
    }
    if (today.getUTCMonth() !== tomorrow.getUTCMonth()) {
      await Promise.all(
        children.map(({ id }) =>
          this.assignments.ensureForDate(id, MissionPeriod.MONTHLY, tomorrow),
        ),
      );
    }
  }
}
