import { ApiProperty } from '@nestjs/swagger';
import { DevelopmentProfile, Language } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsValidBirthDate, BirthDateInRange, BirthDateNotFuture } from 'src/common/validators/birth-date.validator';
import { PartialType } from '@nestjs/swagger';

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
}

export class UpdateChildDto extends PartialType(CreateChildDto) {}

export class ChildDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'date', example: '2018-05-14' })
  birthDate!: string;

  @ApiProperty({ description: 'Derived from birthDate — not persisted' })
  age!: number;

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
