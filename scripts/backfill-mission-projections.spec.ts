import { ChildActivityType, RewardCurrency, RewardReason } from '@prisma/client';
import {
  backfillMissionProjections,
  type BackfillMissionProjectionsReport,
} from './backfill-mission-projections';

type FakeCompletion = {
  id: string;
  childId: string;
  completedAt: Date;
  starAwarded: number;
  crystalAwarded: number;
  feedbackRating: string | null;
  feedbackComment: string | null;
  activityEvent: { id: string } | null;
  rewardTransactions: Array<{ currency: RewardCurrency }>;
};

describe('backfillMissionProjections', () => {
  it('creates activity and positive currency projections without touching balances', async () => {
    const database = new FakeProjectionDatabase([
      completion('completion-1', 'child-1', 4, 2),
      completion('completion-2', 'child-2', 0, 3),
      completion('completion-3', 'child-1', 0, 0),
    ]);
    const balancesBefore = database.balances;

    const report = await backfillMissionProjections(database, { apply: true, batchSize: 2 });

    expect(report).toMatchObject<Partial<BackfillMissionProjectionsReport>>({
      mode: 'apply',
      missionCompletions: 3,
      missingActivityEvents: 3,
      missingRewardTransactions: 3,
      createdActivityEvents: 3,
      createdRewardTransactions: 3,
    });
    expect(database.balances).toEqual(balancesBefore);
    expect(database.events).toEqual([
      {
        childId: 'child-1',
        missionCompletionId: 'completion-1',
        type: ChildActivityType.MISSION_COMPLETED,
        occurredAt: new Date('2026-09-02T15:00:00.000Z'),
      },
      {
        childId: 'child-2',
        missionCompletionId: 'completion-2',
        type: ChildActivityType.MISSION_COMPLETED,
        occurredAt: new Date('2026-09-02T15:00:00.000Z'),
      },
      {
        childId: 'child-1',
        missionCompletionId: 'completion-3',
        type: ChildActivityType.MISSION_COMPLETED,
        occurredAt: new Date('2026-09-02T15:00:00.000Z'),
      },
    ]);
    expect(database.rewards).toEqual([
      expect.objectContaining({
        childId: 'child-1',
        missionCompletionId: 'completion-1',
        currency: RewardCurrency.STAR,
        amount: 4,
        reason: RewardReason.MISSION_COMPLETED,
        occurredAt: new Date('2026-09-02T15:00:00.000Z'),
      }),
      expect.objectContaining({
        childId: 'child-1',
        missionCompletionId: 'completion-1',
        currency: RewardCurrency.CRYSTAL,
        amount: 2,
      }),
      expect.objectContaining({
        childId: 'child-2',
        missionCompletionId: 'completion-2',
        currency: RewardCurrency.CRYSTAL,
        amount: 3,
      }),
    ]);
  });

  it('does not create zero rewards and is a no-op on its second execution', async () => {
    const database = new FakeProjectionDatabase([completion('completion-1', 'child-1', 0, 0)]);

    const first = await backfillMissionProjections(database, { apply: true });
    const second = await backfillMissionProjections(database, { apply: true });

    expect(first.createdActivityEvents).toBe(1);
    expect(first.createdRewardTransactions).toBe(0);
    expect(second.missingActivityEvents).toBe(0);
    expect(second.missingRewardTransactions).toBe(0);
    expect(second.createdActivityEvents).toBe(0);
    expect(second.createdRewardTransactions).toBe(0);
    expect(database.balances).toEqual({
      'child-1': { stars: 10, crystals: 7 },
    });
  });

  it('fills only missing projections and preserves canonical feedback on the completion', async () => {
    const historical = completion('completion-1', 'child-1', 4, 0);
    historical.feedbackRating = 'VERY_FUN';
    historical.feedbackComment = 'Gostei muito!';
    historical.activityEvent = { id: 'existing-event' };
    historical.rewardTransactions = [{ currency: RewardCurrency.STAR }];
    const database = new FakeProjectionDatabase([historical]);

    const report = await backfillMissionProjections(database, { apply: true });

    expect(report.missingActivityEvents).toBe(0);
    expect(report.missingRewardTransactions).toBe(0);
    expect(database.completions[0].feedbackRating).toBe('VERY_FUN');
    expect(database.completions[0].feedbackComment).toBe('Gostei muito!');
    expect(database.events).toHaveLength(0);
    expect(database.rewards).toHaveLength(0);
  });

  it('dry-run reports work without writing any projection or balance', async () => {
    const database = new FakeProjectionDatabase([completion('completion-1', 'child-1', 4, 1)]);

    const report = await backfillMissionProjections(database);

    expect(report).toMatchObject({
      mode: 'dry-run',
      missionCompletions: 1,
      missingActivityEvents: 1,
      missingRewardTransactions: 2,
      createdActivityEvents: 0,
      createdRewardTransactions: 0,
    });
    expect(database.events).toHaveLength(0);
    expect(database.rewards).toHaveLength(0);
  });
});

function completion(
  id: string,
  childId: string,
  starAwarded: number,
  crystalAwarded: number,
): FakeCompletion {
  return {
    id,
    childId,
    completedAt: new Date('2026-09-02T15:00:00.000Z'),
    starAwarded,
    crystalAwarded,
    feedbackRating: null,
    feedbackComment: null,
    activityEvent: null,
    rewardTransactions: [],
  };
}

class FakeProjectionDatabase {
  readonly balances = {
    'child-1': { stars: 10, crystals: 7 },
  };
  readonly events: Array<Record<string, unknown>> = [];
  readonly rewards: Array<Record<string, unknown>> = [];

  constructor(readonly completions: FakeCompletion[]) {}

  readonly missionCompletion = {
    findMany: async (args: { take: number; cursor?: { id: string } }) => {
      const start = args.cursor
        ? this.completions.findIndex((completion) => completion.id === args.cursor!.id) + 1
        : 0;
      return this.completions.slice(start, start + args.take);
    },
  };

  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return callback({
      childActivityEvent: {
        createMany: async (args: { data: Array<Record<string, unknown>> }) => {
          const fresh = args.data.filter(
            (event) =>
              !this.events.some(
                (existing) => existing.missionCompletionId === event.missionCompletionId,
              ),
          );
          this.events.push(...fresh);
          for (const event of fresh) {
            const completion = this.completions.find(
              (item) => item.id === event.missionCompletionId,
            );
            if (completion) completion.activityEvent = { id: `event-${completion.id}` };
          }
          return { count: fresh.length };
        },
      },
      rewardTransaction: {
        createMany: async (args: { data: Array<Record<string, unknown>> }) => {
          const fresh = args.data.filter(
            (reward) =>
              !this.rewards.some(
                (existing) =>
                  existing.missionCompletionId === reward.missionCompletionId &&
                  existing.currency === reward.currency,
              ),
          );
          this.rewards.push(...fresh);
          for (const reward of fresh) {
            const completion = this.completions.find(
              (item) => item.id === reward.missionCompletionId,
            );
            if (completion) {
              completion.rewardTransactions.push({
                currency: reward.currency as RewardCurrency,
              });
            }
          }
          return { count: fresh.length };
        },
      },
    });
  }
}
