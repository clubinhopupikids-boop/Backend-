import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RegisterDto, ResponsiblePublicDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new responsible account' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: ResponsiblePublicDto, description: 'Account created' })
  register(@Body() dto: RegisterDto): Promise<ResponsiblePublicDto> {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a responsible and obtain a JWT' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto, description: 'JWT issued' })
  /**
   * LocalAuthGuard runs the local strategy (email+password verification) and
   * attaches the validated responsible principal to `req.user`.
   */
  login(@Req() req: Request): Promise<LoginResponseDto> {
    return this.authService.login(req.user as ResponsiblePublicDto);
  }
}
