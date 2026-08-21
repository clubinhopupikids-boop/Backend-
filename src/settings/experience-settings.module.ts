import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { ExperienceSettingsController } from './experience-settings.controller';
import { ExperienceSettingsService } from './experience-settings.service';

@Module({
  imports: [ChildrenModule],
  controllers: [ExperienceSettingsController],
  providers: [ExperienceSettingsService],
})
export class ExperienceSettingsModule {}
