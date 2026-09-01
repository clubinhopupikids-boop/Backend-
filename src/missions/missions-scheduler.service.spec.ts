import { MissionPeriod } from '@prisma/client';
import { MissionsSchedulerService } from './missions-scheduler.service';

describe('MissionsSchedulerService', () => {
  const prisma = { child: { findMany: jest.fn() } };
  const assignments = { ensureForDate: jest.fn() };
  const periods = { localDate: jest.fn() };
  const clock = { now: jest.fn() };
  const service = new MissionsSchedulerService(
    prisma as never,
    assignments as never,
    periods as never,
    clock as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.child.findMany.mockResolvedValue([{ id: 'child-1' }]);
  });

  it('pre-generates daily, Sunday weekly and next-month monthly assignments at Saturday month-end', async () => {
    periods.localDate.mockReturnValue(new Date(Date.UTC(2026, 0, 31))); // Saturday, 31 Jan 2026
    await service.prepareNextCycles(new Date('2026-02-01T02:59:59.000Z'));
    const calls = assignments.ensureForDate.mock.calls.map(([id, period, date]) => [
      id,
      period,
      date.toISOString().slice(0, 10),
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['child-1', MissionPeriod.DAILY, '2026-02-01'],
        ['child-1', MissionPeriod.WEEKLY, '2026-02-01'],
        ['child-1', MissionPeriod.MONTHLY, '2026-02-01'],
      ]),
    );
  });

  it('only pre-generates daily assignments on an ordinary day', async () => {
    periods.localDate.mockReturnValue(new Date(Date.UTC(2026, 7, 24)));
    await service.prepareNextCycles(new Date('2026-08-24T12:00:00.000Z'));
    expect(assignments.ensureForDate).toHaveBeenCalledTimes(1);
    expect(assignments.ensureForDate).toHaveBeenCalledWith(
      'child-1',
      MissionPeriod.DAILY,
      new Date(Date.UTC(2026, 7, 25)),
    );
  });
});
