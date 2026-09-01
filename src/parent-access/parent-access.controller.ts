import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireParentAccess } from 'src/common/decorators/require-parent-access.decorator';
import {
  ParentAccessGrantDto,
  ParentAccessStatusDto,
  SetParentPinDto,
  VerifyParentPasswordDto,
  VerifyParentPinDto,
} from './dto/parent-access.dto';
import { ParentAccessService } from './parent-access.service';

@ApiTags('parent-access')
@Controller('parent-access')
export class ParentAccessController {
  constructor(private readonly service: ParentAccessService) {}

  @Get('status')
  @ApiOperation({ summary: 'Return only whether the responsible has a parental PIN' })
  @ApiOkResponse({ type: ParentAccessStatusDto })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user.id);
  }

  @Post('verify-password')
  @ApiOperation({ summary: 'Revalidate the account password and issue temporary parent access' })
  @ApiOkResponse({ type: ParentAccessGrantDto })
  verifyPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyParentPasswordDto) {
    return this.service.verifyPassword(user.id, dto.password);
  }

  @Post('verify-pin')
  @ApiOperation({ summary: 'Validate the parental PIN and issue temporary parent access' })
  @ApiOkResponse({ type: ParentAccessGrantDto })
  verifyPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyParentPinDto) {
    return this.service.verifyPin(user.id, dto.pin);
  }

  @Put('pin')
  @RequireParentAccess()
  @ApiHeader({ name: 'X-Parent-Access-Token', required: true })
  @ApiOperation({ summary: 'Create or replace the parental PIN with valid parent access' })
  @ApiOkResponse({ type: ParentAccessStatusDto })
  setPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetParentPinDto) {
    return this.service.setPin(user.id, dto.pin);
  }

  @Delete('pin')
  @RequireParentAccess()
  @ApiHeader({ name: 'X-Parent-Access-Token', required: true })
  @ApiOperation({ summary: 'Remove the parental PIN with valid parent access' })
  @ApiOkResponse({ type: ParentAccessStatusDto })
  removePin(@CurrentUser() user: AuthenticatedUser) {
    return this.service.removePin(user.id);
  }
}
