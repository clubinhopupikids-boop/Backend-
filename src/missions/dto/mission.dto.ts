import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissionFeedbackRating, MissionPeriod } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class MissionQueryDto {
  @ApiPropertyOptional({ enum: MissionPeriod, default: MissionPeriod.DAILY })
  @IsOptional()
  @IsEnum(MissionPeriod)
  period?: MissionPeriod;
}

export class MissionFeedbackDto {
  @ApiPropertyOptional({ enum: MissionFeedbackRating })
  @IsOptional()
  @IsEnum(MissionFeedbackRating)
  rating?: MissionFeedbackRating;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class MissionCompletionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  missionId!: string;

  @ApiProperty({ enum: MissionPeriod })
  period!: MissionPeriod;

  @ApiProperty({ example: '2026-08-24' })
  periodKey!: string;

  @ApiProperty({ format: 'date-time' })
  completedAt!: Date;

  @ApiProperty({ minimum: 0 })
  starAwarded!: number;

  @ApiProperty({ minimum: 0 })
  crystalAwarded!: number;

  @ApiPropertyOptional({ enum: MissionFeedbackRating, nullable: true })
  feedbackRating!: MissionFeedbackRating | null;

  @ApiPropertyOptional({ nullable: true })
  feedbackComment!: string | null;
}

export class MissionProgressItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: MissionPeriod })
  period!: MissionPeriod;

  @ApiPropertyOptional({ nullable: true })
  iconKey!: string | null;

  @ApiProperty({ minimum: 0 })
  starReward!: number;

  @ApiProperty({ minimum: 0 })
  crystalReward!: number;

  @ApiPropertyOptional({ type: MissionCompletionDto, nullable: true })
  completion!: MissionCompletionDto | null;
}

export class MissionsPeriodDto {
  @ApiProperty({ enum: MissionPeriod })
  period!: MissionPeriod;

  @ApiProperty({ example: '2026-08-24' })
  periodKey!: string;

  @ApiProperty({ minimum: 0 })
  totalCount!: number;

  @ApiProperty({ minimum: 0 })
  completedCount!: number;

  @ApiProperty({ type: [MissionProgressItemDto] })
  missions!: MissionProgressItemDto[];
}

export class CompleteMissionDto {
  @ApiProperty()
  alreadyCompleted!: boolean;

  @ApiProperty({ type: MissionCompletionDto })
  completion!: MissionCompletionDto;

  @ApiProperty({ minimum: 0 })
  stars!: number;

  @ApiProperty({ minimum: 0 })
  crystals!: number;
}
