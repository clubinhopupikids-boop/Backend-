import { BadRequestException, Injectable } from '@nestjs/common';
import { ChildActivityType, Prisma, RewardCurrency, RewardReason } from '@prisma/client';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  ActivityHistoryPageDto,
  ActivityHistoryQueryDto,
  ParentInsightsDto,
  ParentInsightsPeriod,
  ParentTrendBucket,
} from './dto/parent-insights.dto';
import { ParentPeriodService, trendBucketKeys } from './parent-period.service';

const DEFAULT_HISTORY_LIMIT = 30;
const AVAILABILITY = Object.freeze({
  missions: true,
  games: false,
  libraryUsage: false,
  breathing: false,
  emotions: false,
  skills: false,
  achievements: false,
});

type MissionActivitySummaryRow = {
  bucketStartLocalDate: string;
  trackedCount: number;
  missionCount: number;
};

@Injectable()
export class ParentInsightsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
    private readonly periods: ParentPeriodService,
  ) {}

  async insights(
    responsibleId: string,
    childId: string,
    requestedPeriod = ParentInsightsPeriod.WEEK,
  ): Promise<ParentInsightsDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const period = this.periods.resolve(requestedPeriod);
    const currentRange = { gte: period.from, lt: period.to };
    const previousRange = { gte: period.previousFrom, lt: period.previousTo };

    const [missionsCompleted, previousMissions, activitySummary, rewards] = await Promise.all([
      this.prisma.missionCompletion.count({ where: { childId, completedAt: currentRange } }),
      this.prisma.missionCompletion.count({ where: { childId, completedAt: previousRange } }),
      this.missionActivitySummary(childId, period),
      this.prisma.rewardTransaction.groupBy({
        by: ['currency'],
        where: {
          childId,
          reason: RewardReason.MISSION_COMPLETED,
          occurredAt: currentRange,
        },
        _sum: { amount: true },
      }),
    ]);

    const countsByBucket = new Map<string, number>();
    for (const row of activitySummary) {
      countsByBucket.set(
        row.bucketStartLocalDate,
        (countsByBucket.get(row.bucketStartLocalDate) ?? 0) + row.missionCount,
      );
    }
    const rewardByCurrency = new Map(
      rewards.map((reward) => [reward.currency, reward._sum.amount ?? 0]),
    );

    return {
      period: requestedPeriod,
      from: period.from,
      to: period.to,
      timezone: period.timezone,
      availability: { ...AVAILABILITY },
      missionsCompleted,
      trackedActivities: activitySummary.reduce((total, row) => total + row.trackedCount, 0),
      activeDaysFromTrackedActivities: activitySummary.length,
      starsEarnedFromMissions: rewardByCurrency.get(RewardCurrency.STAR) ?? 0,
      crystalsEarnedFromMissions: rewardByCurrency.get(RewardCurrency.CRYSTAL) ?? 0,
      missionPeriodComparison: {
        current: missionsCompleted,
        previous: previousMissions,
        delta: missionsCompleted - previousMissions,
        previousFrom: period.previousFrom,
        previousTo: period.previousTo,
        equivalentElapsedDuration: true,
      },
      missionTrend: {
        bucket: period.trendBucket,
        points: trendBucketKeys(period).map((bucketStartLocalDate) => ({
          bucketStartLocalDate,
          value: countsByBucket.get(bucketStartLocalDate) ?? 0,
        })),
      },
    };
  }

  /**
   * Aggregates the narrow event stream in PostgreSQL before returning it to the service. This
   * avoids loading every event from a three-month interval merely to count days and buckets.
   */
  private async missionActivitySummary(
    childId: string,
    period: {
      from: Date;
      to: Date;
      timezone: string;
      trendBucket: ParentTrendBucket;
    },
  ): Promise<MissionActivitySummaryRow[]> {
    const bucketExpression =
      period.trendBucket === ParentTrendBucket.DAY
        ? Prisma.sql`local_day`
        : Prisma.sql`(local_day - EXTRACT(DOW FROM local_day)::int)`;
    return this.prisma.$queryRaw<MissionActivitySummaryRow[]>(Prisma.sql`
      WITH daily AS (
        SELECT
          (("occurred_at" AT TIME ZONE 'UTC') AT TIME ZONE ${period.timezone})::date AS local_day,
          COUNT(*)::int AS tracked_count,
          COUNT(*) FILTER (
            WHERE "type" = ${ChildActivityType.MISSION_COMPLETED}::"ChildActivityType"
          )::int AS mission_count
        FROM "child_activity_event"
        WHERE "child_id" = ${childId}::uuid
          AND "occurred_at" >= ${period.from}
          AND "occurred_at" < ${period.to}
        GROUP BY 1
      )
      SELECT
        TO_CHAR(${bucketExpression}, 'YYYY-MM-DD') AS "bucketStartLocalDate",
        tracked_count AS "trackedCount",
        mission_count AS "missionCount"
      FROM daily
      ORDER BY local_day ASC
    `);
  }

  async activityHistory(
    responsibleId: string,
    childId: string,
    query: ActivityHistoryQueryDto,
  ): Promise<ActivityHistoryPageDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) throw new BadRequestException('from must be earlier than to');
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const limit = query.limit ?? DEFAULT_HISTORY_LIMIT;
    const occurredAt =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
    const cursorFilter: Prisma.ChildActivityEventWhereInput | undefined = cursor
      ? {
          OR: [
            { occurredAt: { lt: cursor.occurredAt } },
            { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
          ],
        }
      : undefined;

    const rows = await this.prisma.childActivityEvent.findMany({
      where: {
        childId,
        ...(occurredAt ? { occurredAt } : {}),
        ...(query.types?.length ? { type: { in: query.types } } : {}),
        ...(cursorFilter ? { AND: [cursorFilter] } : {}),
      },
      include: {
        missionCompletion: {
          include: { mission: true },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasNextPage = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((event) => {
        const completion = event.missionCompletion;
        const hasFeedback =
          completion.feedbackRating !== null || completion.feedbackComment !== null;
        return {
          eventId: event.id,
          missionCompletionId: completion.id,
          type: event.type,
          occurredAt: event.occurredAt,
          mission: {
            id: completion.mission.id,
            title: completion.mission.title,
            period: completion.period,
          },
          rewards: {
            stars: completion.starAwarded,
            crystals: completion.crystalAwarded,
          },
          missionFeedback: hasFeedback
            ? {
                rating: completion.feedbackRating,
                comment: completion.feedbackComment,
                createdAt: completion.feedbackCreatedAt,
                updatedAt: completion.feedbackUpdatedAt,
              }
            : null,
        };
      }),
      nextCursor:
        hasNextPage && page.length > 0
          ? encodeCursor(page[page.length - 1].occurredAt, page[page.length - 1].id)
          : null,
    };
  }
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id }), 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(value: string): { occurredAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      occurredAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string') throw new Error();
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime()) || !parsed.id) throw new Error();
    return { occurredAt, id: parsed.id };
  } catch {
    throw new BadRequestException('Invalid activity history cursor');
  }
}
