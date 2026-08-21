import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ChildIdParamDto } from 'src/children/dto/child.dto';
import { CommunicationPreferencesService } from './communication-preferences.service';
import {
  CommunicationModeDto,
  UpdateCommunicationPreferencesDto,
} from './dto/communication-preferences.dto';

@ApiTags('communication-preferences')
@Controller('children/:id/communication-preferences')
export class CommunicationPreferencesController {
  constructor(private readonly service: CommunicationPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'List the communication modalities of a child owned by the caller' })
  @ApiOkResponse({ type: [CommunicationModeDto] })
  @ApiNotFoundResponse({ description: 'Child not found' })
  list(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildIdParamDto) {
    return this.service.list(user.id, params.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Replace the communication modalities of a child owned by the caller' })
  @ApiBody({ type: UpdateCommunicationPreferencesDto })
  @ApiOkResponse({ type: [CommunicationModeDto] })
  @ApiNotFoundResponse({ description: 'Child not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildIdParamDto,
    @Body() dto: UpdateCommunicationPreferencesDto,
  ) {
    return this.service.replace(user.id, params.id, dto.modeCodes);
  }
}
