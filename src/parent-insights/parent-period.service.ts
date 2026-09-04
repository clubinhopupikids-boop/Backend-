import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from 'src/config/app.config';
import { ParentInsightsPeriod, ParentTrendBucket } from './dto/parent-insights.dto';

export interface ResolvedParentPeriod {
  period: ParentInsightsPeriod;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  timezone: string;
  trendBucket: ParentTrendBucket;
}

@Injectable()
export class ParentPeriodService {
  constructor(private readonly config: ConfigService) {}

  resolve(period: ParentInsightsPeriod, now = new Date()): ResolvedParentPeriod {
    const timezone = this.config.get<AppConfig>('app')!.missionTimeZone;
    const today = localDateParts(now, timezone);
    let fromLocal: LocalDate;
    let trendBucket = ParentTrendBucket.DAY;

    if (period === ParentInsightsPeriod.WEEK) {
      fromLocal = addLocalDays(today, -dayOfWeek(today));
    } else if (period === ParentInsightsPeriod.THIRTY_DAYS) {
      fromLocal = addLocalDays(today, -29);
    } else {
      fromLocal = addLocalMonths(today, -3);
      trendBucket = ParentTrendBucket.WEEK;
    }

    const from = localMidnightToInstant(fromLocal, timezone);
    const elapsedMs = now.getTime() - from.getTime();
    const previousFrom =
      period === ParentInsightsPeriod.WEEK
        ? localMidnightToInstant(addLocalDays(fromLocal, -7), timezone)
        : new Date(from.getTime() - elapsedMs);
    return {
      period,
      from,
      to: now,
      previousFrom,
      previousTo:
        period === ParentInsightsPeriod.WEEK
          ? new Date(previousFrom.getTime() + elapsedMs)
          : from,
      timezone,
      trendBucket,
    };
  }
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export function localDateKey(instant: Date, timezone: string): string {
  return formatLocalDate(localDateParts(instant, timezone));
}

export function trendBucketKey(instant: Date, timezone: string, bucket: ParentTrendBucket): string {
  const date = localDateParts(instant, timezone);
  return formatLocalDate(
    bucket === ParentTrendBucket.DAY ? date : addLocalDays(date, -dayOfWeek(date)),
  );
}

export function trendBucketKeys(period: ResolvedParentPeriod): string[] {
  const fromLocal = localDateParts(period.from, period.timezone);
  const toLocal = localDateParts(new Date(period.to.getTime() - 1), period.timezone);
  let cursor =
    period.trendBucket === ParentTrendBucket.DAY
      ? fromLocal
      : addLocalDays(fromLocal, -dayOfWeek(fromLocal));
  const step = period.trendBucket === ParentTrendBucket.DAY ? 1 : 7;
  const keys: string[] = [];
  while (compareLocalDates(cursor, toLocal) <= 0) {
    keys.push(formatLocalDate(cursor));
    cursor = addLocalDays(cursor, step);
  }
  return keys;
}

function localDateParts(instant: Date, timezone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function localMidnightToInstant(date: LocalDate, timezone: string): Date {
  const desiredUtc = Date.UTC(date.year, date.month - 1, date.day);
  let candidate = desiredUtc;
  for (let index = 0; index < 3; index += 1) {
    const represented = localDateTimeAsUtc(new Date(candidate), timezone);
    candidate += desiredUtc - represented;
  }
  return new Date(candidate);
}

function localDateTimeAsUtc(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function addLocalMonths(date: LocalDate, months: number): LocalDate {
  const targetMonth = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    year: targetMonth.getUTCFullYear(),
    month: targetMonth.getUTCMonth() + 1,
    day: Math.min(date.day, lastDay),
  };
}

function dayOfWeek(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareLocalDates(left: LocalDate, right: LocalDate): number {
  return (
    Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day)
  );
}

function formatLocalDate(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
