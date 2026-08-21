import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ExperienceSettingsDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  childId!: string;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  animationSpeed!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  soundVolume!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  visualStimulusLevel!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  pupiResponseTime!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  pupiSpeechFrequency!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  instructionComplexity!: number;

  @ApiProperty({ description: 'Technical parameter — not a clinical prescription' })
  maxSimultaneousInteractiveElements!: number;

  @ApiProperty({ default: true })
  narrationEnabled!: boolean;

  @ApiProperty({ default: true })
  musicEnabled!: boolean;

  @ApiProperty({ default: true })
  visualEffectsEnabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * Editable subset of experience settings. All fields optional.
 * Ranges are generic technical bounds — NOT clinical presets.
 * Profile-specific tuning is not implemented at this stage.
 */
export class UpdateExperienceSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(2)
  animationSpeed?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  soundVolume?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  visualStimulusLevel?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  pupiResponseTime?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  pupiSpeechFrequency?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  instructionComplexity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  maxSimultaneousInteractiveElements?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  narrationEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  musicEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  visualEffectsEnabled?: boolean;
}
