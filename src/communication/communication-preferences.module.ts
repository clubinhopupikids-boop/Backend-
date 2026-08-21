import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { CommunicationPreferencesController } from './communication-preferences.controller';
import { CommunicationPreferencesService } from './communication-preferences.service';

@Module({
  imports: [ChildrenModule],
  controllers: [CommunicationPreferencesController],
  providers: [CommunicationPreferencesService],
})
export class CommunicationPreferencesModule {}
