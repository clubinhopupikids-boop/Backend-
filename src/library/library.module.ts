import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { LibraryController } from './library.controller';
import { LibraryPlaybackController } from './library-playback.controller';
import { LibraryPlaybackService } from './library-playback.service';
import { LibraryService } from './library.service';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [StorageModule, ChildrenModule],
  controllers: [LibraryController, LibraryPlaybackController],
  providers: [LibraryService, LibraryPlaybackService],
})
export class LibraryModule {}
