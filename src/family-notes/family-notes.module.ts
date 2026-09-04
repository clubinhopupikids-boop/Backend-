import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { FamilyNotesController } from './family-notes.controller';
import { FamilyNotesService } from './family-notes.service';

@Module({
  imports: [ChildrenModule],
  controllers: [FamilyNotesController],
  providers: [FamilyNotesService],
})
export class FamilyNotesModule {}
