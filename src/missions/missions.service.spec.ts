import {
  ChildActivityType,
  MissionPeriod,
  Prisma,
  RewardCurrency,
  RewardReason,
} from '@prisma/client';
import { MissionsService } from './missions.service';

const completion = {
  id: 'completion-1',
  childId: 'child-1',
  missionId: 'mission-1',
  period: MissionPeriod.DAILY,
  periodKey: '2026-08-24',
  starAwarded: 4,
  crystalAwarded: 0,
  completedAt: new Date('2026-08-24T12:00:00.000Z'),
  feedbackRating: null,
  feedbackComment: null,
  feedbackCreatedAt: null,
  feedbackUpdatedAt: null,
};

describe('MissionsService', () => {
  const childrenService = { getOwned: jest.fn() };
  const periods = { current: jest.fn() };
  const assignments = { getOrCreate: jest.fn() };
  const clock = { now: jest.fn() };
  const tx = {
    missionCompletion: { create: jest.fn() },
    child: { update: jest.fn() },
    rewardTransaction: { create: jest.fn() },
    childActivityEvent: { create: jest.fn() },
  };
  const prisma = {
    mission: { findFirst: jest.fn(), findMany: jest.fn() },
    missionCompletion: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    missionAssignment: { findFirst: jest.fn() },
    child: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: MissionsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new MissionsService(
      prisma as never,
      childrenService as never,
      periods as never,
      assignments as never,
      clock as never,
    );
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
    periods.current.mockReturnValue({ period: MissionPeriod.DAILY, key: '2026-08-24' });
    clock.now.mockReturnValue(new Date('2026-08-24T12:00:00.000Z'));
    prisma.missionAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    prisma.mission.findFirst.mockResolvedValue({
      id: 'mission-1',
      period: MissionPeriod.DAILY,
      starReward: 4,
      crystalReward: 0,
      isActive: true,
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
  });

  it('creates a first completion and credits stars and zero crystals atomically', async () => {
    tx.missionCompletion.create.mockResolvedValue(completion);
    tx.child.update.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).resolves.toMatchObject({
      alreadyCompleted: false,
      stars: 14,
      crystals: 3,
      completion: { starAwarded: 4, crystalAwarded: 0 },
    });
    expect(tx.missionCompletion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ periodKey: '2026-08-24' }) }),
    );
    expect(tx.child.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          starBalance: { increment: 4 },
          crystalBalance: { increment: 0 },
        },
      }),
    );
    expect(tx.rewardTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.rewardTransaction.create).toHaveBeenCalledWith({
      data: {
        childId: 'child-1',
        missionCompletionId: 'completion-1',
        currency: RewardCurrency.STAR,
        amount: 4,
        reason: RewardReason.MISSION_COMPLETED,
        occurredAt: completion.completedAt,
        idempotencyKey: 'mission-completion:completion-1:STAR',
      },
    });
    expect(tx.childActivityEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.childActivityEvent.create).toHaveBeenCalledWith({
      data: {
        childId: 'child-1',
        missionCompletionId: 'completion-1',
        type: ChildActivityType.MISSION_COMPLETED,
        occurredAt: completion.completedAt,
      },
    });
  });

  it('does not credit a second request when the database unique constraint wins a race', async () => {
    tx.missionCompletion.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique completion', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.missionCompletion.findFirst.mockResolvedValue(completion);
    prisma.child.findUniqueOrThrow.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).resolves.toMatchObject({
      alreadyCompleted: true,
      stars: 14,
      crystals: 3,
    });
    expect(tx.child.update).not.toHaveBeenCalled();
    expect(tx.rewardTransaction.create).not.toHaveBeenCalled();
    expect(tx.childActivityEvent.create).not.toHaveBeenCalled();
  });

  it('creates completion, event, reward and balance exactly once across an HTTP retry', async () => {
    tx.missionCompletion.create
      .mockResolvedValueOnce(completion)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique completion', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
    tx.child.update.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });
    prisma.missionCompletion.findFirst.mockResolvedValue(completion);
    prisma.child.findUniqueOrThrow.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });

    const first = await service.complete('responsible-1', 'child-1', 'mission-1');
    const retried = await service.complete('responsible-1', 'child-1', 'mission-1');

    expect(first.alreadyCompleted).toBe(false);
    expect(retried.alreadyCompleted).toBe(true);
    expect(first.completion.id).toBe(retried.completion.id);
    expect(tx.child.update).toHaveBeenCalledTimes(1);
    expect(tx.rewardTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.childActivityEvent.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to complete a mission for a child owned by another responsible', async () => {
    childrenService.getOwned.mockRejectedValue(new Error('Child not found'));

    await expect(service.complete('responsible-2', 'child-1', 'mission-1')).rejects.toThrow(
      'Child not found',
    );
    expect(prisma.mission.findFirst).not.toHaveBeenCalled();
  });

  it('refuses a catalog mission that was not assigned to the child in the current period', async () => {
    prisma.missionAssignment.findFirst.mockResolvedValue(null);

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).rejects.toThrow(
      'Mission is not assigned for the current period',
    );
    expect(tx.missionCompletion.create).not.toHaveBeenCalled();
  });

  it.each([
    [MissionPeriod.WEEKLY, 3, 1],
    [MissionPeriod.MONTHLY, 7, 5],
  ])('credits the configured %s reward', async (period, stars, crystals) => {
    prisma.mission.findFirst.mockResolvedValue({
      id: 'mission-1',
      period,
      starReward: stars,
      crystalReward: crystals,
      isActive: true,
    });
    periods.current.mockReturnValue({ period, key: 'period-key' });
    tx.missionCompletion.create.mockResolvedValue({
      ...completion,
      period,
      periodKey: 'period-key',
      starAwarded: stars,
      crystalAwarded: crystals,
    });
    tx.child.update.mockResolvedValue({ starBalance: stars, crystalBalance: crystals });

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).resolves.toMatchObject({
      stars,
      crystals,
    });
    expect(tx.rewardTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.rewardTransaction.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          currency: RewardCurrency.CRYSTAL,
          amount: crystals,
        }),
      }),
    );
    expect(tx.childActivityEvent.create).toHaveBeenCalledTimes(1);
  });

  it('creates no ledger rows for a supported zero-reward mission but still records activity', async () => {
    prisma.mission.findFirst.mockResolvedValue({
      id: 'mission-1',
      period: MissionPeriod.DAILY,
      starReward: 0,
      crystalReward: 0,
      isActive: true,
    });
    tx.missionCompletion.create.mockResolvedValue({
      ...completion,
      starAwarded: 0,
      crystalAwarded: 0,
    });
    tx.child.update.mockResolvedValue({ starBalance: 10, crystalBalance: 2 });

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).resolves.toMatchObject({
      alreadyCompleted: false,
      stars: 10,
      crystals: 2,
    });
    expect(tx.rewardTransaction.create).not.toHaveBeenCalled();
    expect(tx.childActivityEvent.create).toHaveBeenCalledTimes(1);
  });

  it('propagates a transaction failure without attempting a partial fallback', async () => {
    tx.missionCompletion.create.mockResolvedValue(completion);
    tx.child.update.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });
    tx.rewardTransaction.create.mockRejectedValue(new Error('ledger unavailable'));

    await expect(service.complete('responsible-1', 'child-1', 'mission-1')).rejects.toThrow(
      'ledger unavailable',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.childActivityEvent.create).not.toHaveBeenCalled();
    expect(prisma.missionCompletion.findFirst).not.toHaveBeenCalled();
  });

  it('keeps earlier-period history untouched while reading current progress', async () => {
    assignments.getOrCreate.mockResolvedValue([]);
    prisma.missionCompletion.findMany.mockResolvedValue([]);

    await expect(
      service.listCurrent('responsible-1', 'child-1', MissionPeriod.DAILY),
    ).resolves.toMatchObject({
      periodKey: '2026-08-24',
      totalCount: 0,
      completedCount: 0,
    });
    expect(prisma.missionCompletion.findMany).toHaveBeenCalledWith({
      where: { childId: 'child-1', period: MissionPeriod.DAILY, periodKey: '2026-08-24' },
    });
  });

  it('allows feedback to remain empty without changing the completion', async () => {
    prisma.missionCompletion.findFirst.mockResolvedValue(completion);

    await expect(
      service.saveFeedback('responsible-1', 'child-1', 'completion-1', {}),
    ).resolves.toMatchObject({ id: 'completion-1', feedbackRating: null, feedbackComment: null });
    expect(prisma.missionCompletion.update).not.toHaveBeenCalled();
  });

  it('saves optional rating and comment after completion', async () => {
    prisma.missionCompletion.findFirst.mockResolvedValue(completion);
    prisma.missionCompletion.update.mockResolvedValue({
      ...completion,
      feedbackRating: 'VERY_FUN',
      feedbackComment: 'Gostei muito!',
    });

    await expect(
      service.saveFeedback('responsible-1', 'child-1', 'completion-1', {
        rating: 'VERY_FUN',
        comment: 'Gostei muito!',
      }),
    ).resolves.toMatchObject({ feedbackRating: 'VERY_FUN', feedbackComment: 'Gostei muito!' });
    expect(prisma.missionCompletion.update).toHaveBeenCalled();
  });
});
