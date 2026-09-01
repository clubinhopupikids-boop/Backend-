import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ParentAccessStatusDto {
  @ApiProperty({ description: 'Whether this responsible has a parental PIN configured' })
  hasPin!: boolean;
}

export class VerifyParentPasswordDto {
  @ApiProperty({ minLength: 1, maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class VerifyParentPinDto {
  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN must contain exactly 6 digits' })
  pin!: string;
}

export class SetParentPinDto extends VerifyParentPinDto {}

export class ParentAccessGrantDto extends ParentAccessStatusDto {
  @ApiProperty({ description: 'Short-lived ticket for parent-only endpoints' })
  parentAccessToken!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;
}
