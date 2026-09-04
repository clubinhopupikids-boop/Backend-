import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChildActivityType,
  LibraryContentType,
  MissionFeedbackRating,
  MissionPeriod,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum ParentInsightsPeriod {
  WEEK = 'WEEK',
  THIRTY_DAYS = 'THIRTY_DAYS',
  THREE_MONTHS = 'THREE_MONTHS',
}

export enum ParentTrendBucket {
  DAY = 'DAY',
  WEEK = 'WEEK',
}

export class ParentInsightsQueryDto {
  @ApiPropertyOptional({ enum: ParentInsightsPeriod, default: ParentInsightsPeriod.WEEK })
  @IsOptional()
  @IsEnum(ParentInsightsPeriod)
  period?: ParentInsightsPeriod;
}

export class ChildParentInsightsParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId!: string;
}

export class ParentDataAvailabilityDto {
  @ApiProperty() missions!: boolean;
  @ApiProperty() games!: boolean;
  @ApiProperty() libraryUsage!: boolean;
  @ApiProperty() breathing!: boolean;
  @ApiProperty() emotions!: boolean;
  @ApiProperty() skills!: boolean;
  @ApiProperty() achievements!: boolean;
}

export class MissionPeriodComparisonDto {
  @ApiProperty() current!: number;
  @ApiProperty() previous!: number;
  @ApiProperty() delta!: number;
  @ApiProperty({ format: 'date-time' }) previousFrom!: Date;
  @ApiProperty({ format: 'date-time' }) previousTo!: Date;
  @ApiProperty({ description: 'The previous interval has exactly the same elapsed duration.' })
  equivalentElapsedDuration!: boolean;
}

export class MissionTrendPointDto {
  @ApiProperty({ example: '2026-09-02' }) bucketStartLocalDate!: string;
  @ApiProperty() value!: number;
}

export class MissionTrendDto {
  @ApiProperty({ enum: ParentTrendBucket }) bucket!: ParentTrendBucket;
  @ApiProperty({ type: [MissionTrendPointDto] }) points!: MissionTrendPointDto[];
}

export class LibraryMostAccessedDto {
  @ApiProperty({ format: 'uuid' }) contentId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: LibraryContentType }) contentType!: LibraryContentType;
  @ApiProperty({ minimum: 1 }) accessCount!: number;
}

export class LibraryInsightsDto {
  @ApiProperty() contentsStarted!: number;
  @ApiProperty() contentsCompleted!: number;
  @ApiProperty() storiesStarted!: number;
  @ApiProperty() storiesCompleted!: number;
  @ApiProperty() musicStarted!: number;
  @ApiProperty() musicCompleted!: number;
  @ApiProperty() videosStarted!: number;
  @ApiProperty() videosCompleted!: number;
  @ApiProperty({ type: [LibraryMostAccessedDto] }) mostAccessed!: LibraryMostAccessedDto[];
}

export class ParentInsightsDto {
  @ApiProperty({ enum: ParentInsightsPeriod }) period!: ParentInsightsPeriod;
  @ApiProperty({ format: 'date-time' }) from!: Date;
  @ApiProperty({ format: 'date-time' }) to!: Date;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone!: string;
  @ApiProperty({ type: ParentDataAvailabilityDto }) availability!: ParentDataAvailabilityDto;
  @ApiProperty() missionsCompleted!: number;
  @ApiProperty() trackedActivities!: number;
  @ApiProperty() activeDaysFromTrackedActivities!: number;
  @ApiProperty() starsEarnedFromMissions!: number;
  @ApiProperty() crystalsEarnedFromMissions!: number;
  @ApiProperty({ type: LibraryInsightsDto }) library!: LibraryInsightsDto;
  @ApiProperty({ type: MissionPeriodComparisonDto })
  missionPeriodComparison!: MissionPeriodComparisonDto;
  @ApiProperty({ type: MissionTrendDto }) missionTrend!: MissionTrendDto;
}

export class ActivityHistoryQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Inclusive lower bound' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Exclusive upper bound' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: ChildActivityType, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').filter(Boolean)
        : value,
  )
  @IsEnum(ChildActivityType, { each: true })
  types?: ChildActivityType[];

  @ApiPropertyOptional({ description: 'Opaque cursor returned by the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MissionHistorySummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: MissionPeriod }) period!: MissionPeriod;
}

export class MissionHistoryRewardsDto {
  @ApiProperty() stars!: number;
  @ApiProperty() crystals!: number;
}

export class MissionHistoryFeedbackDto {
  @ApiPropertyOptional({ enum: MissionFeedbackRating, nullable: true })
  rating!: MissionFeedbackRating | null;
  @ApiPropertyOptional({ nullable: true }) comment!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  createdAt!: Date | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  updatedAt!: Date | null;
}

export enum ActivityHistoryItemType {
  MISSION = 'MISSION',
  LIBRARY = 'LIBRARY',
}

export class LibraryHistoryDto {
  @ApiProperty({ format: 'uuid' }) contentId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: LibraryContentType }) contentType!: LibraryContentType;
  @ApiProperty({ format: 'date-time' }) startedAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) completedAt!: Date | null;
}

export class ActivityHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) missionCompletionId!: string | null;
  @ApiProperty({ enum: ActivityHistoryItemType }) type!: ActivityHistoryItemType;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiPropertyOptional({ type: MissionHistorySummaryDto, nullable: true })
  mission!: MissionHistorySummaryDto | null;
  @ApiPropertyOptional({ type: MissionHistoryRewardsDto, nullable: true })
  rewards!: MissionHistoryRewardsDto | null;
  @ApiPropertyOptional({ type: MissionHistoryFeedbackDto, nullable: true })
  missionFeedback!: MissionHistoryFeedbackDto | null;
  @ApiPropertyOptional({ type: LibraryHistoryDto, nullable: true })
  library!: LibraryHistoryDto | null;
}

export class ActivityHistoryPageDto {
  @ApiProperty({ type: [ActivityHistoryItemDto] }) items!: ActivityHistoryItemDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}
