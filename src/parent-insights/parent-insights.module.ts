import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { ParentInsightsController } from './parent-insights.controller';
import { ParentInsightsQueryService } from './parent-insights-query.service';
import { ParentPeriodService } from './parent-period.service';

@Module({
  imports: [ChildrenModule],
  controllers: [ParentInsightsController],
  providers: [ParentInsightsQueryService, ParentPeriodService],
  exports: [ParentInsightsQueryService],
})
export class ParentInsightsModule {}
