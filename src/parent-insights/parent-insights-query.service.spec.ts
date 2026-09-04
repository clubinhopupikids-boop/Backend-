import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ChildActivityType,
  MissionFeedbackRating,
  MissionPeriod,
  RewardCurrency,
} from '@prisma/client';
import { ParentInsightsPeriod, ParentTrendBucket } from './dto/parent-insights.dto';
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

describe('ParentInsightsQueryService', () => {
  const prisma = {
    missionCompletion: { count: jest.fn() },
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
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.rewardTransaction.groupBy.mockResolvedValue([]);
  });

  it('returns measured mission zeroes while unavailable domains have no misleading metrics', async () => {
    const result = await service.insights('responsible-1', 'child-1');

    expect(result).toMatchObject({
      missionsCompleted: 0,
      trackedActivities: 0,
      activeDaysFromTrackedActivities: 0,
      starsEarnedFromMissions: 0,
      crystalsEarnedFromMissions: 0,
      availability: {
        missions: true,
        games: false,
        libraryUsage: false,
        breathing: false,
        emotions: false,
        skills: false,
        achievements: false,
      },
    });
    expect(result).not.toHaveProperty('emotions');
    expect(result).not.toHaveProperty('emotionCounts');
  });

  it('reports one canonical completion as one measured mission', async () => {
    prisma.missionCompletion.count.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.$queryRaw.mockResolvedValue([
      { bucketStartLocalDate: '2026-09-02', trackedCount: 1, missionCount: 1 },
    ]);

    const result = await service.insights('responsible-1', 'child-1');

    expect(result.missionsCompleted).toBe(1);
    expect(result.trackedActivities).toBe(1);
    expect(prisma.missionCompletion.count).toHaveBeenNthCalledWith(1, {
      where: {
        childId: 'child-1',
        completedAt: { gte: resolvedPeriod.from, lt: resolvedPeriod.to },
      },
    });
    expect(prisma.missionCompletion.count).toHaveBeenNthCalledWith(2, {
      where: {
        childId: 'child-1',
        completedAt: { gte: resolvedPeriod.previousFrom, lt: resolvedPeriod.previousTo },
      },
    });
  });

  it('calculates mission totals, rewards, local active days, comparison and zero-filled trend', async () => {
    prisma.missionCompletion.count.mockReset().mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.$queryRaw.mockResolvedValue([
      { bucketStartLocalDate: '2026-08-30', trackedCount: 2, missionCount: 2 },
      { bucketStartLocalDate: '2026-09-02', trackedCount: 1, missionCount: 1 },
    ]);
    prisma.rewardTransaction.groupBy.mockResolvedValue([
      { currency: RewardCurrency.STAR, _sum: { amount: 12 } },
      { currency: RewardCurrency.CRYSTAL, _sum: { amount: 2 } },
    ]);

    const result = await service.insights('responsible-1', 'child-1');

    expect(result.activeDaysFromTrackedActivities).toBe(2);
    expect(result.missionPeriodComparison).toMatchObject({ current: 3, previous: 1, delta: 2 });
    expect(result.starsEarnedFromMissions).toBe(12);
    expect(result.crystalsEarnedFromMissions).toBe(2);
    expect(prisma.rewardTransaction.groupBy).toHaveBeenCalledWith({
      by: ['currency'],
      where: {
        childId: 'child-1',
        reason: 'MISSION_COMPLETED',
        occurredAt: { gte: resolvedPeriod.from, lt: resolvedPeriod.to },
      },
      _sum: { amount: true },
    });
    expect(result.missionTrend.points).toEqual([
      { bucketStartLocalDate: '2026-08-30', value: 2 },
      { bucketStartLocalDate: '2026-08-31', value: 0 },
      { bucketStartLocalDate: '2026-09-01', value: 0 },
      { bucketStartLocalDate: '2026-09-02', value: 1 },
    ]);
  });

  it('counts active days from the tracked stream while the trend remains mission-specific', async () => {
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
    expect(prisma.childActivityEvent.findMany).not.toHaveBeenCalled();
  });

  it('enforces ownership before querying any parental fact', async () => {
    childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));

    await expect(service.insights('responsible-2', 'child-1')).rejects.toThrow('Child not found');
    expect(prisma.missionCompletion.count).not.toHaveBeenCalled();
  });
});

describe('ParentInsightsQueryService activity history', () => {
  const prisma = {
    missionCompletion: { count: jest.fn() },
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
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'event-1',
    childId: 'child-1',
    type: ChildActivityType.MISSION_COMPLETED,
    occurredAt: new Date('2026-09-02T15:00:00.000Z'),
    missionCompletionId: 'completion-1',
    missionCompletion: {
      id: 'completion-1',
      period: MissionPeriod.DAILY,
      starAwarded: 4,
      crystalAwarded: 1,
      feedbackRating: null,
      feedbackComment: null,
      feedbackCreatedAt: null,
      feedbackUpdatedAt: null,
      mission: { id: 'mission-1', title: 'Organizar os brinquedos' },
      ...overrides,
    },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
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
    prisma.childActivityEvent.findMany.mockResolvedValue([row(feedback)]);

    const result = await service.activityHistory('responsible-1', 'child-1', {});

    expect(result.items[0]).toMatchObject({
      mission: { id: 'mission-1', title: 'Organizar os brinquedos', period: MissionPeriod.DAILY },
      rewards: { stars: 4, crystals: 1 },
    });
    if (expected === null) expect(result.items[0].missionFeedback).toBeNull();
    else expect(result.items[0].missionFeedback).toMatchObject(expected);
  });

  it('uses [from,to), supported type filtering, stable order, limit and an opaque cursor', async () => {
    prisma.childActivityEvent.findMany.mockResolvedValue([
      row(),
      { ...row(), id: 'event-0', occurredAt: new Date('2026-09-01T15:00:00Z') },
    ]);

    const first = await service.activityHistory('responsible-1', 'child-1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-03T00:00:00.000Z',
      types: [ChildActivityType.MISSION_COMPLETED],
      limit: 1,
    });

    expect(first.nextCursor).not.toBeNull();
    expect(prisma.childActivityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          childId: 'child-1',
          occurredAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-09-03T00:00:00.000Z'),
          },
          type: { in: [ChildActivityType.MISSION_COMPLETED] },
        }),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );

    prisma.childActivityEvent.findMany.mockResolvedValue([]);
    await service.activityHistory('responsible-1', 'child-1', { cursor: first.nextCursor! });
    expect(prisma.childActivityEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { occurredAt: { lt: new Date('2026-09-02T15:00:00.000Z') } },
                {
                  occurredAt: new Date('2026-09-02T15:00:00.000Z'),
                  id: { lt: 'event-1' },
                },
              ],
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
    expect(prisma.childActivityEvent.findMany).not.toHaveBeenCalled();
  });
});
