import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MissionPeriod } from '@prisma/client';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ChildIdParamDto } from 'src/children/dto/child.dto';
import {
  CompleteMissionDto,
  MissionFeedbackDto,
  MissionCompletionDto,
  MissionQueryDto,
  MissionsPeriodDto,
} from './dto/mission.dto';
import { ChildMissionCompletionParamDto, ChildMissionParamDto } from './dto/mission.params.dto';
import { MissionsService } from './missions.service';

@ApiTags('missions')
@Controller('children/:id')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get('missions')
  @ApiOperation({ summary: 'Get active missions and current-period progress for an owned child' })
  @ApiOkResponse({ type: MissionsPeriodDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildIdParamDto,
    @Query() query: MissionQueryDto,
  ) {
    return this.service.listCurrent(user.id, params.id, query.period ?? MissionPeriod.DAILY);
  }

  @Post('missions/:missionId/complete')
  @ApiOperation({ summary: 'Atomically complete a mission and award its current-period reward' })
  @ApiOkResponse({ type: CompleteMissionDto })
  @ApiNotFoundResponse({ description: 'Child or mission not found' })
  complete(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildMissionParamDto) {
    return this.service.complete(user.id, params.id, params.missionId);
  }

  @Patch('mission-completions/:completionId/feedback')
  @ApiOperation({ summary: 'Create or edit optional feedback for an owned mission completion' })
  @ApiBody({ type: MissionFeedbackDto })
  @ApiOkResponse({ type: MissionCompletionDto })
  @ApiNotFoundResponse({ description: 'Child or mission completion not found' })
  saveFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildMissionCompletionParamDto,
    @Body() dto: MissionFeedbackDto,
  ) {
    return this.service.saveFeedback(user.id, params.id, params.completionId, dto);
  }
}
