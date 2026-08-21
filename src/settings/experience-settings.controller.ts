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
import { ExperienceSettingsService } from './experience-settings.service';
import {
  ExperienceSettingsDto,
  UpdateExperienceSettingsDto,
} from './dto/experience-settings.dto';

@ApiTags('experience-settings')
@Controller('children/:id/settings')
export class ExperienceSettingsController {
  constructor(private readonly service: ExperienceSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the experience settings for a child owned by the caller' })
  @ApiOkResponse({ type: ExperienceSettingsDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildIdParamDto) {
    return this.service.get(user.id, params.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the experience settings for a child owned by the caller' })
  @ApiBody({ type: UpdateExperienceSettingsDto })
  @ApiOkResponse({ type: ExperienceSettingsDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildIdParamDto,
    @Body() dto: UpdateExperienceSettingsDto,
  ) {
    return this.service.update(user.id, params.id, dto);
  }
}
