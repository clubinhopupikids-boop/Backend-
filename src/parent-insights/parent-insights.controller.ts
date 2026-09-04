import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireParentAccess } from 'src/common/decorators/require-parent-access.decorator';
import {
  ActivityHistoryPageDto,
  ActivityHistoryQueryDto,
  ChildParentInsightsParamDto,
  ParentInsightsDto,
  ParentInsightsPeriod,
  ParentInsightsQueryDto,
} from './dto/parent-insights.dto';
import { ParentInsightsQueryService } from './parent-insights-query.service';

@ApiTags('parent-insights')
@ApiHeader({ name: 'X-Parent-Access-Token', required: true })
@RequireParentAccess()
@Controller('children/:childId')
export class ParentInsightsController {
  constructor(private readonly service: ParentInsightsQueryService) {}

  @Get('parent-insights')
  @ApiOperation({ summary: 'Get mission-backed parental insights for an owned child' })
  @ApiOkResponse({ type: ParentInsightsDto })
  insights(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildParentInsightsParamDto,
    @Query() query: ParentInsightsQueryDto,
  ) {
    return this.service.insights(
      user.id,
      params.childId,
      query.period ?? ParentInsightsPeriod.WEEK,
    );
  }

  @Get('activity-history')
  @ApiOperation({ summary: 'Get stable, cursor-paginated activity history for an owned child' })
  @ApiOkResponse({ type: ActivityHistoryPageDto })
  activityHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildParentInsightsParamDto,
    @Query() query: ActivityHistoryQueryDto,
  ) {
    return this.service.activityHistory(user.id, params.childId, query);
  }
}
