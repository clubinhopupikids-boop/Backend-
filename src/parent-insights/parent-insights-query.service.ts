import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ChildActivityType,
  LibraryContentType,
  Prisma,
  RewardCurrency,
  RewardReason,
} from '@prisma/client';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  ActivityHistoryPageDto,
  ActivityHistoryQueryDto,
  ActivityHistoryItemType,
  ParentInsightsDto,
  ParentInsightsPeriod,
  ParentTrendBucket,
} from './dto/parent-insights.dto';
import { ParentPeriodService, trendBucketKeys } from './parent-period.service';

const DEFAULT_HISTORY_LIMIT = 30;
const AVAILABILITY = Object.freeze({
  missions: true,
  games: false,
  libraryUsage: true,
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

type LibraryPlaybackInsightRow = {
  completedAt: Date | null;
  libraryContent: {
    id: string;
    title: string;
    type: LibraryContentType;
  };
};

type CompletedLibraryPlaybackRow = {
  libraryContent: { type: LibraryContentType };
};

type HistorySource = 'MISSION' | 'LIBRARY';

type HistoryRow = {
  source: HistorySource;
  id: string;
  occurredAt: Date;
  item: ActivityHistoryPageDto['items'][number];
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

    const [missionsCompleted, previousMissions, activitySummary, rewards, library] = await Promise.all([
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
      this.libraryInsights(childId, currentRange),
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
      library,
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

  private async libraryInsights(
    childId: string,
    range: { gte: Date; lt: Date },
  ): Promise<ParentInsightsDto['library']> {
    const [started, completed] = await Promise.all([
      this.prisma.libraryPlayback.findMany({
        where: { childId, startedAt: range },
        select: {
          completedAt: true,
          libraryContent: { select: { id: true, title: true, type: true } },
        },
      }),
      this.prisma.libraryPlayback.findMany({
        where: { childId, completedAt: range },
        select: { libraryContent: { select: { type: true } } },
      }),
    ]);

    const countType = (
      rows: Array<{ libraryContent: { type: LibraryContentType } }>,
      type: LibraryContentType,
    ) => rows.filter((row) => row.libraryContent.type === type).length;
    const accessCounts = new Map<
      string,
      { contentId: string; title: string; contentType: LibraryContentType; accessCount: number }
    >();
    for (const row of started as LibraryPlaybackInsightRow[]) {
      const content = row.libraryContent;
      const current = accessCounts.get(content.id);
      if (current) current.accessCount += 1;
      else {
        accessCounts.set(content.id, {
          contentId: content.id,
          title: content.title,
          contentType: content.type,
          accessCount: 1,
        });
      }
    }

    const mostAccessed = [...accessCounts.values()]
      .sort(
        (left, right) =>
          right.accessCount - left.accessCount || left.contentId.localeCompare(right.contentId),
      )
      .slice(0, 5);

    return {
      contentsStarted: started.length,
      contentsCompleted: completed.length,
      storiesStarted: countType(started as LibraryPlaybackInsightRow[], LibraryContentType.STORIES),
      storiesCompleted: countType(
        completed as CompletedLibraryPlaybackRow[],
        LibraryContentType.STORIES,
      ),
      musicStarted: countType(started as LibraryPlaybackInsightRow[], LibraryContentType.MUSIC),
      musicCompleted: countType(
        completed as CompletedLibraryPlaybackRow[],
        LibraryContentType.MUSIC,
      ),
      videosStarted: countType(started as LibraryPlaybackInsightRow[], LibraryContentType.VIDEOS),
      videosCompleted: countType(
        completed as CompletedLibraryPlaybackRow[],
        LibraryContentType.VIDEOS,
      ),
      mostAccessed,
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
          AND "type" IN (
            ${ChildActivityType.MISSION_COMPLETED}::"ChildActivityType",
            ${ChildActivityType.LIBRARY_STARTED}::"ChildActivityType"
          )
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
    const requestedTypes = query.types ?? [];
    const includeMission =
      requestedTypes.length === 0 || requestedTypes.includes(ChildActivityType.MISSION_COMPLETED);
    const includeLibrary =
      requestedTypes.length === 0 ||
      requestedTypes.includes(ChildActivityType.LIBRARY_STARTED) ||
      requestedTypes.includes(ChildActivityType.LIBRARY_COMPLETED);
    const libraryEventTypes = requestedTypes.filter(
      (type) =>
        type === ChildActivityType.LIBRARY_STARTED || type === ChildActivityType.LIBRARY_COMPLETED,
    );

    const [missionRows, libraryRows] = await Promise.all([
      includeMission
        ? this.prisma.missionCompletion.findMany({
            where: {
              childId,
              ...(occurredAt ? { completedAt: occurredAt } : {}),
              activityEvent: { isNot: null },
              ...(cursor ? missionCursorWhere(cursor) : {}),
            },
            include: {
              mission: true,
              activityEvent: true,
            },
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : [],
      includeLibrary
        ? this.prisma.libraryPlayback.findMany({
            where: {
              childId,
              ...(occurredAt ? { startedAt: occurredAt } : {}),
              activityEvents: {
                some: {
                  type: libraryEventTypes.length
                    ? { in: libraryEventTypes }
                    : ChildActivityType.LIBRARY_STARTED,
                },
              },
              ...(cursor ? libraryCursorWhere(cursor) : {}),
            },
            include: {
              libraryContent: true,
              activityEvents: {
                where: { type: ChildActivityType.LIBRARY_STARTED },
                take: 1,
              },
            },
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : [],
    ]);

    const rows: HistoryRow[] = [
      ...missionRows.flatMap((completion) => {
        if (!completion.activityEvent) return [];
        const hasFeedback =
          completion.feedbackRating !== null || completion.feedbackComment !== null;
        return [
          {
            source: 'MISSION' as const,
            id: completion.id,
            occurredAt: completion.completedAt,
            item: {
              eventId: completion.activityEvent.id,
              missionCompletionId: completion.id,
              type: ActivityHistoryItemType.MISSION,
              occurredAt: completion.completedAt,
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
              library: null,
            },
          },
        ];
      }),
      ...libraryRows.flatMap((playback) => {
        const startedEvent = playback.activityEvents[0];
        if (!startedEvent) return [];
        return [
          {
            source: 'LIBRARY' as const,
            id: playback.id,
            occurredAt: playback.startedAt,
            item: {
              eventId: startedEvent.id,
              missionCompletionId: null,
              type: ActivityHistoryItemType.LIBRARY,
              occurredAt: playback.startedAt,
              mission: null,
              rewards: null,
              missionFeedback: null,
              library: {
                contentId: playback.libraryContent.id,
                title: playback.libraryContent.title,
                contentType: playback.libraryContent.type,
                startedAt: playback.startedAt,
                completedAt: playback.completedAt,
              },
            },
          },
        ];
      }),
    ].sort(compareHistoryRows);
    const hasNextPage = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => row.item),
      nextCursor:
        hasNextPage && page.length > 0
          ? encodeCursor(
              page[page.length - 1].occurredAt,
              rows[limit - 1].id,
              rows[limit - 1].source,
            )
          : null,
    };
  }
}

function compareHistoryRows(left: HistoryRow, right: HistoryRow): number {
  const byTime = right.occurredAt.getTime() - left.occurredAt.getTime();
  if (byTime !== 0) return byTime;
  const leftKey = historySortKey(left.source, left.id);
  const rightKey = historySortKey(right.source, right.id);
  return rightKey.localeCompare(leftKey);
}

function historySortKey(source: HistorySource, id: string): string {
  return `${source === 'MISSION' ? '0' : '1'}:${id}`;
}

function missionCursorWhere(cursor: HistoryCursor): Prisma.MissionCompletionWhereInput {
  return {
    OR:
      cursor.source === 'LIBRARY'
        ? [
            { completedAt: { lt: cursor.occurredAt } },
            { completedAt: cursor.occurredAt },
          ]
        : [
            { completedAt: { lt: cursor.occurredAt } },
            { completedAt: cursor.occurredAt, id: { lt: cursor.id } },
          ],
  };
}

function libraryCursorWhere(cursor: HistoryCursor): Prisma.LibraryPlaybackWhereInput {
  return {
    OR:
      cursor.source === 'MISSION'
        ? [{ startedAt: { lt: cursor.occurredAt } }]
        : [
            { startedAt: { lt: cursor.occurredAt } },
            { startedAt: cursor.occurredAt, id: { lt: cursor.id } },
          ],
  };
}

type HistoryCursor = { occurredAt: Date; id: string; source: HistorySource };

function encodeCursor(occurredAt: Date, id: string, source: HistorySource): string {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id, source }), 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(value: string): HistoryCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      occurredAt?: unknown;
      id?: unknown;
      source?: unknown;
    };
    if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string') throw new Error();
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime()) || !parsed.id) throw new Error();
    const source = parsed.source === 'LIBRARY' ? 'LIBRARY' : 'MISSION';
    return { occurredAt, id: parsed.id, source };
  } catch {
    throw new BadRequestException('Invalid activity history cursor');
  }
}
