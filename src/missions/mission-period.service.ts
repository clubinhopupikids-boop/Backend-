import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MissionPeriod } from '@prisma/client';
import type { AppConfig } from 'src/config/app.config';

export interface CurrentMissionPeriod {
  period: MissionPeriod;
  key: string;
  localDate?: Date;
}

@Injectable()
export class MissionPeriodService {
  constructor(private readonly config: ConfigService) {}

  current(period: MissionPeriod, now: Date): CurrentMissionPeriod {
    return this.forDate(period, this.localDate(now));
  }

  forDate(period: MissionPeriod, localDate: Date): CurrentMissionPeriod {
    return { period, key: missionPeriodKey(period, localDate), localDate };
  }

  previous(period: MissionPeriod, now: Date): CurrentMissionPeriod {
    const date = this.localDate(now);
    if (period === MissionPeriod.DAILY) date.setUTCDate(date.getUTCDate() - 1);
    if (period === MissionPeriod.WEEKLY) date.setUTCDate(date.getUTCDate() - 7);
    if (period === MissionPeriod.MONTHLY) date.setUTCMonth(date.getUTCMonth() - 1, 1);
    return this.forDate(period, date);
  }

  localDate(now: Date): Date {
    const cfg = this.config.get<AppConfig>('app')!;
    return dateInTimeZone(now, cfg.missionTimeZone);
  }
}

export function missionPeriodKey(period: MissionPeriod, date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (period === MissionPeriod.DAILY) return `${year}-${month}-${day}`;
  if (period === MissionPeriod.MONTHLY) return `${year}-${month}`;

  const sunday = new Date(date);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return `WEEK_${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
}

function dateInTimeZone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return new Date(Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day'))));
}
