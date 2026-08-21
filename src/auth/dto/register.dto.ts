import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Public representation of a responsible account — never includes passwordHash. */
export class ResponsiblePublicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Language })
  language!: Language;

  @ApiProperty({ type: String, format: 'date-time' })
  termsAcceptedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class RegisterDto {
  @ApiProperty({ example: 'parent@example.com', description: 'Unique account email' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ enum: Language, default: Language.PT_BR })
  @IsEnum(Language)
  language!: Language;

  @ApiProperty({ example: true, description: 'Must be true to register' })
  @IsBoolean()
  termsAccepted!: boolean;
}
