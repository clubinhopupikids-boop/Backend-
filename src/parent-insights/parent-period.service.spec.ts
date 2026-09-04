import { ParentInsightsPeriod, ParentTrendBucket } from './dto/parent-insights.dto';
import { ParentPeriodService } from './parent-period.service';

describe('ParentPeriodService', () => {
  const config = {
    get: jest.fn().mockReturnValue({ missionTimeZone: 'America/Sao_Paulo' }),
  };
  const service = new ParentPeriodService(config as never);

  it('resolves the current, incomplete week from Sunday in the product timezone', () => {
    const result = service.resolve(ParentInsightsPeriod.WEEK, new Date('2026-09-02T18:00:00.000Z'));

    expect(result).toMatchObject({
      from: new Date('2026-08-30T03:00:00.000Z'),
      to: new Date('2026-09-02T18:00:00.000Z'),
      previousFrom: new Date('2026-08-23T03:00:00.000Z'),
      previousTo: new Date('2026-08-26T18:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      trendBucket: ParentTrendBucket.DAY,
    });
    expect(result.previousTo.getTime() - result.previousFrom.getTime()).toBe(
      result.to.getTime() - result.from.getTime(),
    );
  });

  it('uses daily buckets for rolling 30 local dates and weekly buckets for three months', () => {
    const now = new Date('2026-09-02T18:00:00.000Z');
    expect(service.resolve(ParentInsightsPeriod.THIRTY_DAYS, now)).toMatchObject({
      from: new Date('2026-08-04T03:00:00.000Z'),
      trendBucket: ParentTrendBucket.DAY,
    });
    expect(service.resolve(ParentInsightsPeriod.THREE_MONTHS, now)).toMatchObject({
      from: new Date('2026-06-02T03:00:00.000Z'),
      trendBucket: ParentTrendBucket.WEEK,
    });
  });
});
