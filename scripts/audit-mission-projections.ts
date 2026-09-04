import { loadDotEnv } from './load-dotenv';
import { ChildActivityType, PrismaClient } from '@prisma/client';

/** Read-only deployment audit. It prints counts only and never selects personal fields. */
export async function auditMissionProjections(prisma: {
  missionCompletion: { count(): Promise<number> };
  childActivityEvent: { count(args: { where: { type: ChildActivityType } }): Promise<number> };
  rewardTransaction: { count(): Promise<number> };
}): Promise<{
  missionCompletions: number;
  activityEvents: number | 'TABLE_UNAVAILABLE';
  rewardTransactions: number | 'TABLE_UNAVAILABLE';
}> {
  const missionCompletions = await prisma.missionCompletion.count();
  const activityEvents = await countIfTableExists(() =>
    prisma.childActivityEvent.count({ where: { type: ChildActivityType.MISSION_COMPLETED } }),
  );
  const rewardTransactions = await countIfTableExists(() => prisma.rewardTransaction.count());
  return { missionCompletions, activityEvents, rewardTransactions };
}

async function countIfTableExists(
  count: () => Promise<number>,
): Promise<number | 'TABLE_UNAVAILABLE'> {
  try {
    return await count();
  } catch (error) {
    if (isMissingTableError(error)) return 'TABLE_UNAVAILABLE';
    throw error;
  }
}

function isMissingTableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('does not exist') || error.message.includes('P2021'))
  );
}

async function main(): Promise<void> {
  await loadDotEnv();
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await auditMissionProjections(prisma)));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      'MISSION_PROJECTION_AUDIT_FAILED',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
