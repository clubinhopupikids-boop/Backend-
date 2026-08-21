import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

/** A single communication modality a child can use (e.g. VOICE, TOUCH). */
export class CommunicationModeDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;
}

/**
 * Replace the child's set of communication modalities. Sending an empty array
 * clears all preferences. Unknown codes are rejected by the service.
 */
export class UpdateCommunicationPreferencesDto {
  @ApiProperty({
    type: [String],
    example: ['VOICE', 'IMAGES_SYMBOLS'],
    description: 'Communication mode codes to assign (replaces the current set).',
  })
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  modeCodes!: string[];
}
