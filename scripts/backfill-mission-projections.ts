import { loadDotEnv } from './load-dotenv';
import { ChildActivityType, RewardCurrency, RewardReason, type Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const DEFAULT_BATCH_SIZE = 500;

export interface BackfillMissionProjectionsOptions {
  apply?: boolean;
  batchSize?: number;
}

export interface BackfillMissionProjectionsReport {
  mode: 'dry-run' | 'apply';
  missionCompletions: number;
  missingActivityEvents: number;
  missingRewardTransactions: number;
  createdActivityEvents: number;
  createdRewardTransactions: number;
}

type CompletionProjection = {
  id: string;
  childId: string;
  completedAt: Date;
  starAwarded: number;
  crystalAwarded: number;
  activityEvent: { id: string } | null;
  rewardTransactions: Array<{ currency: RewardCurrency }>;
};

interface BackfillTransaction {
  childActivityEvent: {
    createMany(args: {
      data: Array<{
        childId: string;
        missionCompletionId: string;
        type: ChildActivityType;
        occurredAt: Date;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
  rewardTransaction: {
    createMany(args: {
      data: Array<{
        childId: string;
        missionCompletionId: string;
        currency: RewardCurrency;
        amount: number;
        reason: RewardReason;
        occurredAt: Date;
        idempotencyKey: string;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
}

interface BackfillPrisma {
  missionCompletion: {
    findMany(args: Prisma.MissionCompletionFindManyArgs): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: BackfillTransaction) => Promise<T>): Promise<T>;
}

/**
 * Rebuilds only projections for historical mission completions. It deliberately never reads or
 * writes Child.starBalance or Child.crystalBalance: those balances were already awarded when the
 * completion was created. The database uniqueness constraints make a repeated --apply safe.
 */
export async function backfillMissionProjections(
  prisma: BackfillPrisma,
  options: BackfillMissionProjectionsOptions = {},
): Promise<BackfillMissionProjectionsReport> {
  const apply = options.apply === true;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('batchSize must be an integer between 1 and 5000');
  }

  const report: BackfillMissionProjectionsReport = {
    mode: apply ? 'apply' : 'dry-run',
    missionCompletions: 0,
    missingActivityEvents: 0,
    missingRewardTransactions: 0,
    createdActivityEvents: 0,
    createdRewardTransactions: 0,
  };
  let cursorId: string | undefined;

  while (true) {
    const completions = (await prisma.missionCompletion.findMany({
      take: batchSize,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        childId: true,
        completedAt: true,
        starAwarded: true,
        crystalAwarded: true,
        activityEvent: { select: { id: true } },
        rewardTransactions: { select: { currency: true } },
      },
    })) as CompletionProjection[];
    if (completions.length === 0) break;

    report.missionCompletions += completions.length;
    const missingEvents = completions.filter((completion) => completion.activityEvent === null);
    const missingRewards = completions.flatMap((completion) => {
      const currencies = new Set(
        completion.rewardTransactions.map((transaction) => transaction.currency),
      );
      const result: Array<{
        childId: string;
        missionCompletionId: string;
        currency: RewardCurrency;
        amount: number;
        reason: RewardReason;
        occurredAt: Date;
        idempotencyKey: string;
      }> = [];
      if (completion.starAwarded > 0 && !currencies.has(RewardCurrency.STAR)) {
        result.push(rewardData(completion, RewardCurrency.STAR, completion.starAwarded));
      }
      if (completion.crystalAwarded > 0 && !currencies.has(RewardCurrency.CRYSTAL)) {
        result.push(rewardData(completion, RewardCurrency.CRYSTAL, completion.crystalAwarded));
      }
      return result;
    });
    report.missingActivityEvents += missingEvents.length;
    report.missingRewardTransactions += missingRewards.length;

    if (apply && (missingEvents.length > 0 || missingRewards.length > 0)) {
      const created = await prisma.$transaction(async (tx) => {
        const events = missingEvents.length
          ? await tx.childActivityEvent.createMany({
              data: missingEvents.map((completion) => ({
                childId: completion.childId,
                missionCompletionId: completion.id,
                type: ChildActivityType.MISSION_COMPLETED,
                occurredAt: completion.completedAt,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };
        const rewards = missingRewards.length
          ? await tx.rewardTransaction.createMany({
              data: missingRewards,
              skipDuplicates: true,
            })
          : { count: 0 };
        return { events: events.count, rewards: rewards.count };
      });
      report.createdActivityEvents += created.events;
      report.createdRewardTransactions += created.rewards;
    }

    cursorId = completions[completions.length - 1].id;
    if (completions.length < batchSize) break;
  }

  return report;
}

function rewardData(
  completion: Pick<CompletionProjection, 'id' | 'childId' | 'completedAt'>,
  currency: RewardCurrency,
  amount: number,
) {
  return {
    childId: completion.childId,
    missionCompletionId: completion.id,
    currency,
    amount,
    reason: RewardReason.MISSION_COMPLETED,
    occurredAt: completion.completedAt,
    idempotencyKey: `mission-completion:${completion.id}:${currency}`,
  };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const prisma = new PrismaClient();
  const apply = process.argv.includes('--apply');
  try {
    const report = await backfillMissionProjections(prisma, { apply });
    console.log(JSON.stringify(report));
    if (!apply) {
      console.log('Dry-run only. Re-run with --apply after reviewing counts and migration state.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      'MISSION_PROJECTION_BACKFILL_FAILED',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
