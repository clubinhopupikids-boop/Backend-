import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChildrenModule } from 'src/children/children.module';
import { MissionPeriodService } from './mission-period.service';
import { MissionAssignmentService } from './mission-assignment.service';
import { MissionClock } from './mission-clock.service';
import { MissionRandom, MissionSelectionService } from './mission-selection.service';
import { MissionsSchedulerService } from './missions-scheduler.service';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [ChildrenModule, ScheduleModule.forRoot()],
  controllers: [MissionsController],
  providers: [
    MissionsService,
    MissionPeriodService,
    MissionClock,
    MissionRandom,
    MissionSelectionService,
    MissionAssignmentService,
    MissionsSchedulerService,
  ],
})
export class MissionsModule {}
