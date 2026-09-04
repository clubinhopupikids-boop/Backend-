import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ChildActivityType,
  LibraryContentType,
  MissionFeedbackRating,
  MissionPeriod,
  RewardCurrency,
} from '@prisma/client';
import {
  ActivityHistoryItemType,
  ParentInsightsPeriod,
  ParentTrendBucket,
} from './dto/parent-insights.dto';
import { ParentInsightsQueryService } from './parent-insights-query.service';

const resolvedPeriod = {
  period: ParentInsightsPeriod.WEEK,
  from: new Date('2026-08-30T03:00:00.000Z'),
  to: new Date('2026-09-02T18:00:00.000Z'),
  previousFrom: new Date('2026-08-26T12:00:00.000Z'),
  previousTo: new Date('2026-08-30T03:00:00.000Z'),
  timezone: 'America/Sao_Paulo',
  trendBucket: ParentTrendBucket.DAY,
};

describe('ParentInsightsQueryService insights', () => {
  const prisma = {
    missionCompletion: { count: jest.fn(), findMany: jest.fn() },
    libraryPlayback: { findMany: jest.fn() },
    childActivityEvent: { findMany: jest.fn() },
    rewardTransaction: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const childrenService = { getOwned: jest.fn() };
  const periods = { resolve: jest.fn() };
  const service = new ParentInsightsQueryService(
    prisma as never,
    childrenService as never,
    periods as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
    periods.resolve.mockReturnValue(resolvedPeriod);
    prisma.missionCompletion.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.libraryPlayback.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.rewardTransaction.groupBy.mockResolvedValue([]);
  });

  it('exposes library availability and measured zeroes without inventing unsupported domains', async () => {
    const result = await service.insights('responsible-1', 'child-1');

    expect(result).toMatchObject({
      missionsCompleted: 0,
      trackedActivities: 0,
      activeDaysFromTrackedActivities: 0,
      availability: {
        missions: true,
        games: false,
        libraryUsage: true,
        breathing: false,
        emotions: false,
        skills: false,
        achievements: false,
      },
      library: {
        contentsStarted: 0,
        contentsCompleted: 0,
        storiesStarted: 0,
        storiesCompleted: 0,
        musicStarted: 0,
        musicCompleted: 0,
        videosStarted: 0,
        videosCompleted: 0,
        mostAccessed: [],
      },
    });
    expect(result).not.toHaveProperty('emotions');
    expect(result).not.toHaveProperty('emotionCounts');
  });

  it('counts started and completed library participations by official catalog type', async () => {
    prisma.libraryPlayback.findMany
      .mockReset()
      .mockResolvedValueOnce([
        {
          completedAt: null,
          libraryContent: {
            id: 'story-1',
            title: 'Uma história',
            type: LibraryContentType.STORIES,
          },
        },
        {
          completedAt: new Date('2026-09-02T17:00:00.000Z'),
          libraryContent: {
            id: 'music-1',
            title: 'Uma música',
            type: LibraryContentType.MUSIC,
          },
        },
        {
          completedAt: null,
          libraryContent: {
            id: 'story-1',
            title: 'Uma história',
            type: LibraryContentType.STORIES,
          },
        },
      ])
      .mockResolvedValueOnce([
        { libraryContent: { type: LibraryContentType.STORIES } },
        { libraryContent: { type: LibraryContentType.MUSIC } },
      ]);

    const result = await service.insights('responsible-1', 'child-1');

    expect(result.library).toMatchObject({
      contentsStarted: 3,
      contentsCompleted: 2,
      storiesStarted: 2,
      storiesCompleted: 1,
      musicStarted: 1,
      musicCompleted: 1,
      videosStarted: 0,
      videosCompleted: 0,
    });
    expect(result.library.mostAccessed).toEqual([
      {
        contentId: 'story-1',
        title: 'Uma história',
        contentType: LibraryContentType.STORIES,
        accessCount: 2,
      },
      {
        contentId: 'music-1',
        title: 'Uma música',
        contentType: LibraryContentType.MUSIC,
        accessCount: 1,
      },
    ]);
  });

  it('counts one tracked activity per mission or library start, never library completion', async () => {
    prisma.missionCompletion.count
      .mockReset()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.libraryPlayback.findMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValue([
      { bucketStartLocalDate: '2026-08-30', trackedCount: 3, missionCount: 2 },
      { bucketStartLocalDate: '2026-09-02', trackedCount: 2, missionCount: 1 },
    ]);
    prisma.rewardTransaction.groupBy.mockResolvedValue([
      { currency: RewardCurrency.STAR, _sum: { amount: 12 } },
      { currency: RewardCurrency.CRYSTAL, _sum: { amount: 2 } },
    ]);

    const result = await service.insights('responsible-1', 'child-1');

    expect(result.trackedActivities).toBe(5);
    expect(result.activeDaysFromTrackedActivities).toBe(2);
    expect(result.missionTrend.points).toEqual([
      { bucketStartLocalDate: '2026-08-30', value: 2 },
      { bucketStartLocalDate: '2026-08-31', value: 0 },
      { bucketStartLocalDate: '2026-09-01', value: 0 },
      { bucketStartLocalDate: '2026-09-02', value: 1 },
    ]);
    expect(result.starsEarnedFromMissions).toBe(12);
    expect(result.crystalsEarnedFromMissions).toBe(2);
  });

  it('keeps the trend mission-specific while the tracked stream includes library starts', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { bucketStartLocalDate: '2026-09-02', trackedCount: 2, missionCount: 1 },
    ]);

    const result = await service.insights('responsible-1', 'child-1');

    expect(result.trackedActivities).toBe(2);
    expect(result.activeDaysFromTrackedActivities).toBe(1);
    expect(result.missionTrend.points.at(-1)).toEqual({
      bucketStartLocalDate: '2026-09-02',
      value: 1,
    });
  });

  it('enforces ownership before querying any parental fact', async () => {
    childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));

    await expect(service.insights('responsible-2', 'child-1')).rejects.toThrow('Child not found');
    expect(prisma.missionCompletion.count).not.toHaveBeenCalled();
    expect(prisma.libraryPlayback.findMany).not.toHaveBeenCalled();
  });
});

describe('ParentInsightsQueryService activity history', () => {
  const prisma = {
    missionCompletion: { count: jest.fn(), findMany: jest.fn() },
    libraryPlayback: { findMany: jest.fn() },
    childActivityEvent: { findMany: jest.fn() },
    rewardTransaction: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const childrenService = { getOwned: jest.fn() };
  const periods = { resolve: jest.fn() };
  const service = new ParentInsightsQueryService(
    prisma as never,
    childrenService as never,
    periods as never,
  );

  const mission = (overrides: Record<string, unknown> = {}) => ({
    id: 'completion-1',
    childId: 'child-1',
    period: MissionPeriod.DAILY,
    starAwarded: 4,
    crystalAwarded: 1,
    completedAt: new Date('2026-09-02T15:00:00.000Z'),
    feedbackRating: null,
    feedbackComment: null,
    feedbackCreatedAt: null,
    feedbackUpdatedAt: null,
    mission: { id: 'mission-1', title: 'Organizar os brinquedos' },
    activityEvent: {
      id: 'event-mission-1',
      type: ChildActivityType.MISSION_COMPLETED,
      occurredAt: new Date('2026-09-02T15:00:00.000Z'),
    },
    ...overrides,
  });

  const playback = (overrides: Record<string, unknown> = {}) => ({
    id: 'playback-1',
    childId: 'child-1',
    startedAt: new Date('2026-09-02T14:00:00.000Z'),
    completedAt: new Date('2026-09-02T14:05:00.000Z'),
    libraryContent: {
      id: 'content-1',
      title: 'O Monstro das Cores',
      type: LibraryContentType.STORIES,
    },
    activityEvents: [
      {
        id: 'event-library-start-1',
        type: ChildActivityType.LIBRARY_STARTED,
        occurredAt: new Date('2026-09-02T14:00:00.000Z'),
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
    prisma.missionCompletion.findMany.mockResolvedValue([]);
    prisma.libraryPlayback.findMany.mockResolvedValue([]);
  });

  it.each([
    ['without feedback', {}, null],
    [
      'rating only',
      { feedbackRating: MissionFeedbackRating.FUN },
      { rating: MissionFeedbackRating.FUN, comment: null },
    ],
    [
      'comment only',
      { feedbackComment: 'Fiz sozinho.' },
      { rating: null, comment: 'Fiz sozinho.' },
    ],
    [
      'rating and comment',
      {
        feedbackRating: MissionFeedbackRating.VERY_FUN,
        feedbackComment: 'Adorei!',
        feedbackCreatedAt: new Date('2026-09-02T15:01:00Z'),
        feedbackUpdatedAt: new Date('2026-09-02T15:02:00Z'),
      },
      {
        rating: MissionFeedbackRating.VERY_FUN,
        comment: 'Adorei!',
        createdAt: new Date('2026-09-02T15:01:00Z'),
        updatedAt: new Date('2026-09-02T15:02:00Z'),
      },
    ],
  ])('returns a mission %s from its canonical completion', async (_label, feedback, expected) => {
    prisma.missionCompletion.findMany.mockResolvedValue([mission(feedback)]);

    const result = await service.activityHistory('responsible-1', 'child-1', {
      types: [ChildActivityType.MISSION_COMPLETED],
    });

    expect(result.items[0]).toMatchObject({
      type: ActivityHistoryItemType.MISSION,
      mission: { id: 'mission-1', title: 'Organizar os brinquedos', period: MissionPeriod.DAILY },
      rewards: { stars: 4, crystals: 1 },
      library: null,
    });
    if (expected === null) expect(result.items[0].missionFeedback).toBeNull();
    else expect(result.items[0].missionFeedback).toMatchObject(expected);
    expect(prisma.libraryPlayback.findMany).not.toHaveBeenCalled();
  });

  it('mixes missions and library chronologically while projecting one item per playback', async () => {
    prisma.missionCompletion.findMany.mockResolvedValue([mission()]);
    prisma.libraryPlayback.findMany.mockResolvedValue([playback()]);

    const result = await service.activityHistory('responsible-1', 'child-1', {});

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.type)).toEqual([
      ActivityHistoryItemType.MISSION,
      ActivityHistoryItemType.LIBRARY,
    ]);
    expect(result.items[1]).toMatchObject({
      eventId: 'event-library-start-1',
      missionCompletionId: null,
      type: ActivityHistoryItemType.LIBRARY,
      library: {
        contentId: 'content-1',
        title: 'O Monstro das Cores',
        contentType: LibraryContentType.STORIES,
        startedAt: new Date('2026-09-02T14:00:00.000Z'),
        completedAt: new Date('2026-09-02T14:05:00.000Z'),
      },
      mission: null,
      rewards: null,
      missionFeedback: null,
    });
  });

  it('uses canonical participation pagination and technical filters without returning completion as a second item', async () => {
    prisma.missionCompletion.findMany.mockResolvedValue([mission()]);
    prisma.libraryPlayback.findMany.mockResolvedValue([playback()]);

    const first = await service.activityHistory('responsible-1', 'child-1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-03T00:00:00.000Z',
      types: [ChildActivityType.MISSION_COMPLETED, ChildActivityType.LIBRARY_STARTED],
      limit: 1,
    });

    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    expect(prisma.missionCompletion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          childId: 'child-1',
          completedAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-09-03T00:00:00.000Z'),
          },
          activityEvent: { isNot: null },
        }),
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );
    expect(prisma.libraryPlayback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          childId: 'child-1',
          startedAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-09-03T00:00:00.000Z'),
          },
          activityEvents: {
            some: { type: { in: [ChildActivityType.LIBRARY_STARTED] } },
          },
        }),
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );

    prisma.missionCompletion.findMany.mockResolvedValue([]);
    prisma.libraryPlayback.findMany.mockResolvedValue([]);
    await service.activityHistory('responsible-1', 'child-1', { cursor: first.nextCursor! });
    expect(prisma.missionCompletion.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activityEvent: { isNot: null },
          OR: [
            { completedAt: { lt: new Date('2026-09-02T15:00:00.000Z') } },
            {
              completedAt: new Date('2026-09-02T15:00:00.000Z'),
              id: { lt: 'completion-1' },
            },
          ],
        }),
      }),
    );
  });

  it('rejects invalid ranges and cursors', async () => {
    await expect(
      service.activityHistory('responsible-1', 'child-1', {
        from: '2026-09-03T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.activityHistory('responsible-1', 'child-1', { cursor: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never queries or leaks activity or feedback for another family', async () => {
    childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));

    await expect(service.activityHistory('responsible-2', 'child-1', {})).rejects.toThrow(
      'Child not found',
    );
    expect(prisma.missionCompletion.findMany).not.toHaveBeenCalled();
    expect(prisma.libraryPlayback.findMany).not.toHaveBeenCalled();
  });
});
