import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { DevelopmentProfile, Language } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { IsValidBirthDate, BirthDateInRange, BirthDateNotFuture } from 'src/common/validators/birth-date.validator';

export class CreateChildDto {
  @ApiProperty({ example: 'Luna' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '2018-05-14', description: 'Birth date in YYYY-MM-DD format' })
  @IsString()
  @IsValidBirthDate()
  @BirthDateNotFuture()
  @BirthDateInRange(3, 12, { message: 'Child must be between 3 and 12 years old' })
  birthDate!: string;

  @ApiProperty({ enum: Language, default: Language.PT_BR })
  @IsEnum(Language)
  primaryLanguage!: Language;

  @ApiProperty({
    enum: DevelopmentProfile,
    nullable: true,
    required: false,
    description:
      'Optional initial setup label. Never drives clinical branching on the backend.',
  })
  @IsOptional()
  @IsEnum(DevelopmentProfile)
  developmentProfile?: DevelopmentProfile;

  @ApiProperty({
    type: [String],
    required: false,
    example: ['VOICE', 'IMAGES_SYMBOLS'],
    description: 'Optional stable communication-mode codes, persisted atomically with the child.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/\S/, { each: true, message: 'communicationModeCodes cannot contain blank values' })
  communicationModeCodes?: string[];
}

export class UpdateChildDto extends PartialType(
  OmitType(CreateChildDto, ['communicationModeCodes'] as const),
) {}

export class ChildDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'date', example: '2018-05-14' })
  birthDate!: string;

  @ApiProperty({ enum: Language })
  primaryLanguage!: Language;

  @ApiProperty({ enum: DevelopmentProfile, nullable: true })
  developmentProfile!: DevelopmentProfile | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class ChildIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}
