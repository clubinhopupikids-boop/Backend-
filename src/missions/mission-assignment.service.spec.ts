import { MissionPeriod, MissionRarity, Prisma } from '@prisma/client';
import { MissionAssignmentService } from './mission-assignment.service';

describe('MissionAssignmentService', () => {
  const catalog = Array.from({ length: 10 }, (_, index) => ({
    id: `mission-${index + 1}`,
    code: `code-${index + 1}`,
    exclusionGroup: null,
    displayOrder: index,
    period: MissionPeriod.DAILY,
    isActive: true,
    rarity: MissionRarity.NORMAL,
  }));
  let rows: Array<{
    childId: string;
    missionId: string;
    period: MissionPeriod;
    periodKey: string;
    slot: number;
  }> = [];
  const missionAssignment = {
    findMany: jest.fn(),
    createMany: jest.fn(),
  };
  const prisma = {
    missionAssignment,
    mission: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const periods = {} as never;
  const clock = {} as never;
  const selection = {
    select: jest.fn(
      (candidates: typeof catalog, previous: Set<string>, _groups: Set<string>, limit: number) =>
        candidates.filter((mission) => !previous.has(mission.id)).slice(0, limit),
    ),
  };
  let service: MissionAssignmentService;

  beforeEach(() => {
    rows = [];
    jest.clearAllMocks();
    missionAssignment.findMany.mockImplementation(({ where }: { where: (typeof rows)[number] }) =>
      rows
        .filter(
          (row) =>
            row.childId === where.childId &&
            row.period === where.period &&
            row.periodKey === where.periodKey,
        )
        .sort((a, b) => a.slot - b.slot)
        .map((row) => ({
          ...row,
          mission: catalog.find((mission) => mission.id === row.missionId)!,
        })),
    );
    missionAssignment.createMany.mockImplementation(({ data }: { data: typeof rows }) => {
      if (
        rows.some(
          (row) =>
            row.childId === data[0].childId &&
            row.period === data[0].period &&
            row.periodKey === data[0].periodKey,
        )
      ) {
        throw new Prisma.PrismaClientKnownRequestError('unique assignment set', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      rows.push(...data);
      return { count: data.length };
    });
    prisma.mission.findMany.mockResolvedValue(catalog);
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    service = new MissionAssignmentService(prisma as never, periods, clock, selection as never);
  });

  it('creates five stable daily assignments once and keeps their ordered slots on repeat', async () => {
    const current = { period: MissionPeriod.DAILY, key: '2026-08-24' };
    const previous = { period: MissionPeriod.DAILY, key: '2026-08-23' };
    const first = await service.ensure('child-1', current, previous);
    const second = await service.ensure('child-1', current, previous);
    expect(first).toHaveLength(5);
    expect(second.map((assignment) => assignment.missionId)).toEqual(
      first.map((assignment) => assignment.missionId),
    );
    expect(second.map((assignment) => assignment.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses a new key and avoids the immediately previous set when alternatives exist', async () => {
    const yesterday = { period: MissionPeriod.DAILY, key: '2026-08-23' };
    const today = { period: MissionPeriod.DAILY, key: '2026-08-24' };
    const beforeYesterday = { period: MissionPeriod.DAILY, key: '2026-08-22' };
    const old = await service.ensure('child-1', yesterday, beforeYesterday);
    const next = await service.ensure('child-1', today, yesterday);
    expect(next).toHaveLength(5);
    expect(next.map((assignment) => assignment.missionId)).not.toEqual(
      old.map((assignment) => assignment.missionId),
    );
    expect(
      next.some((assignment) =>
        old.some((previous) => previous.missionId === assignment.missionId),
      ),
    ).toBe(false);
  });

  it('keeps one persisted set when lazy creation races for the same cycle', async () => {
    const current = { period: MissionPeriod.DAILY, key: '2026-08-24' };
    const previous = { period: MissionPeriod.DAILY, key: '2026-08-23' };
    const [first, second] = await Promise.all([
      service.ensure('child-1', current, previous),
      service.ensure('child-1', current, previous),
    ]);
    expect(rows).toHaveLength(5);
    expect(first.map((assignment) => assignment.missionId)).toEqual(
      second.map((assignment) => assignment.missionId),
    );
  });
});
