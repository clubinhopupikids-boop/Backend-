import { MissionPeriod } from '@prisma/client';
import { MissionPeriodService, missionPeriodKey } from './mission-period.service';

describe('missionPeriodKey', () => {
  it('uses the Sunday beginning of the product week, including a year boundary', () => {
    expect(missionPeriodKey(MissionPeriod.WEEKLY, new Date(Date.UTC(2021, 0, 1)))).toBe(
      'WEEK_2020-12-27',
    );
    expect(missionPeriodKey(MissionPeriod.WEEKLY, new Date(Date.UTC(2026, 7, 23)))).toBe(
      'WEEK_2026-08-23',
    );
    expect(missionPeriodKey(MissionPeriod.WEEKLY, new Date(Date.UTC(2026, 7, 29)))).toBe(
      'WEEK_2026-08-23',
    );
    expect(missionPeriodKey(MissionPeriod.WEEKLY, new Date(Date.UTC(2026, 7, 30)))).toBe(
      'WEEK_2026-08-30',
    );
  });

  it('formats daily and monthly keys from a date-only value', () => {
    const date = new Date(Date.UTC(2026, 7, 24));
    expect(missionPeriodKey(MissionPeriod.DAILY, date)).toBe('2026-08-24');
    expect(missionPeriodKey(MissionPeriod.MONTHLY, date)).toBe('2026-08');
    expect(missionPeriodKey(MissionPeriod.DAILY, new Date(Date.UTC(2026, 1, 28)))).toBe(
      '2026-02-28',
    );
    expect(missionPeriodKey(MissionPeriod.DAILY, new Date(Date.UTC(2024, 1, 29)))).toBe(
      '2024-02-29',
    );
    expect(missionPeriodKey(MissionPeriod.DAILY, new Date(Date.UTC(2026, 3, 30)))).toBe(
      '2026-04-30',
    );
    expect(missionPeriodKey(MissionPeriod.DAILY, new Date(Date.UTC(2026, 11, 31)))).toBe(
      '2026-12-31',
    );
    expect(missionPeriodKey(MissionPeriod.MONTHLY, new Date(Date.UTC(2027, 0, 1)))).toBe('2027-01');
  });

  it('changes weekly cycle exactly at Sunday 00:00 in Brasília, not UTC or ISO Monday', () => {
    const service = new MissionPeriodService({
      get: jest.fn().mockReturnValue({ missionTimeZone: 'America/Sao_Paulo' }),
    } as never);
    const saturday235958 = new Date('2026-08-30T02:59:58.000Z');
    const saturday235959 = new Date('2026-08-30T02:59:59.000Z');
    const sunday000000 = new Date('2026-08-30T03:00:00.000Z');
    expect(service.current(MissionPeriod.WEEKLY, saturday235958).key).toBe('WEEK_2026-08-23');
    expect(service.current(MissionPeriod.WEEKLY, saturday235959).key).toBe('WEEK_2026-08-23');
    expect(service.current(MissionPeriod.WEEKLY, sunday000000).key).toBe('WEEK_2026-08-30');
  });
});
