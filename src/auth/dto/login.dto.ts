import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ResponsiblePublicDto } from './register.dto';

export class LoginDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: () => ResponsiblePublicDto })
  user!: ResponsiblePublicDto;
}
