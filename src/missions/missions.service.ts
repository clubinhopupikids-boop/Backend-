import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MissionPeriod, MissionRarity, Prisma } from '@prisma/client';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import type {
  CompleteMissionDto,
  MissionCompletionDto,
  MissionFeedbackDto,
  MissionProgressItemDto,
  MissionsPeriodDto,
} from './dto/mission.dto';
import { MissionPeriodService } from './mission-period.service';
import { MissionAssignmentService } from './mission-assignment.service';
import { MissionClock } from './mission-clock.service';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
    private readonly periods: MissionPeriodService,
    private readonly assignments: MissionAssignmentService,
    private readonly clock: MissionClock,
  ) {}

  async listCurrent(
    responsibleId: string,
    childId: string,
    period: MissionPeriod,
  ): Promise<MissionsPeriodDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const now = this.clock.now();
    const current = this.periods.current(period, now);
    const [assignments, completions] = await Promise.all([
      this.assignments.getOrCreate(childId, period, now),
      this.prisma.missionCompletion.findMany({
        where: { childId, period, periodKey: current.key },
      }),
    ]);
    const byMissionId = new Map(
      completions.map((completion) => [completion.missionId, completion]),
    );
    const items: MissionProgressItemDto[] = assignments.map((assignment) => ({
      id: assignment.mission.id,
      title: assignment.mission.title,
      description: assignment.mission.description,
      period,
      iconKey: assignment.mission.iconKey,
      starReward: assignment.mission.starReward,
      crystalReward: assignment.mission.crystalReward,
      completion: this.toCompletionDto(byMissionId.get(assignment.mission.id) ?? null),
    }));
    return {
      period,
      periodKey: current.key,
      totalCount: items.length,
      completedCount: items.filter((item) => item.completion !== null).length,
      missions: items,
    };
  }

  async complete(
    responsibleId: string,
    childId: string,
    missionId: string,
  ): Promise<CompleteMissionDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, isActive: true, rarity: MissionRarity.NORMAL },
    });
    if (!mission || !mission.period) throw new NotFoundException('Mission not found');
    const missionPeriod = mission.period;
    const current = this.periods.current(missionPeriod, this.clock.now());
    const assigned = await this.prisma.missionAssignment.findFirst({
      where: { childId, missionId, period: missionPeriod, periodKey: current.key },
    });
    if (!assigned) {
      throw new ConflictException('Mission is not assigned for the current period');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const completion = await tx.missionCompletion.create({
          data: {
            childId,
            missionId: mission.id,
            period: missionPeriod,
            periodKey: current.key,
            starAwarded: mission.starReward,
            crystalAwarded: mission.crystalReward,
          },
        });
        const child = await tx.child.update({
          where: { id: childId },
          data: {
            starBalance: { increment: mission.starReward },
            crystalBalance: { increment: mission.crystalReward },
          },
          select: { starBalance: true, crystalBalance: true },
        });
        return { completion, child };
      });
      return {
        alreadyCompleted: false,
        completion: this.toCompletionDto(created.completion)!,
        stars: created.child.starBalance,
        crystals: created.child.crystalBalance,
      };
    } catch (error) {
      if (!isUniqueCompletionError(error)) throw error;
      const existing = await this.prisma.missionCompletion.findFirst({
        where: { childId, missionId: mission.id, period: missionPeriod, periodKey: current.key },
      });
      if (!existing) throw error;
      const child = await this.prisma.child.findUniqueOrThrow({
        where: { id: childId },
        select: { starBalance: true, crystalBalance: true },
      });
      return {
        alreadyCompleted: true,
        completion: this.toCompletionDto(existing)!,
        stars: child.starBalance,
        crystals: child.crystalBalance,
      };
    }
  }

  async saveFeedback(
    responsibleId: string,
    childId: string,
    completionId: string,
    dto: MissionFeedbackDto,
  ): Promise<MissionCompletionDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const existing = await this.prisma.missionCompletion.findFirst({
      where: { id: completionId, childId },
    });
    if (!existing) throw new NotFoundException('Mission completion not found');
    if (dto.rating === undefined && dto.comment === undefined)
      return this.toCompletionDto(existing)!;

    const now = new Date();
    const updated = await this.prisma.missionCompletion.update({
      where: { id: existing.id },
      data: {
        ...(dto.rating !== undefined ? { feedbackRating: dto.rating } : {}),
        ...(dto.comment !== undefined ? { feedbackComment: dto.comment.trim() || null } : {}),
        feedbackCreatedAt: existing.feedbackCreatedAt ?? now,
        feedbackUpdatedAt: now,
      },
    });
    return this.toCompletionDto(updated)!;
  }

  private toCompletionDto(
    completion: {
      id: string;
      missionId: string;
      period: MissionPeriod;
      periodKey: string;
      completedAt: Date;
      starAwarded: number;
      crystalAwarded: number;
      feedbackRating: MissionCompletionDto['feedbackRating'];
      feedbackComment: string | null;
    } | null,
  ): MissionCompletionDto | null {
    if (!completion) return null;
    return {
      id: completion.id,
      missionId: completion.missionId,
      period: completion.period,
      periodKey: completion.periodKey,
      completedAt: completion.completedAt,
      starAwarded: completion.starAwarded,
      crystalAwarded: completion.crystalAwarded,
      feedbackRating: completion.feedbackRating,
      feedbackComment: completion.feedbackComment,
    };
  }
}

function isUniqueCompletionError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
