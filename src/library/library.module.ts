import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { StorageModule } from 'src/storage/storage.module';

@Module({ imports: [StorageModule], controllers: [LibraryController], providers: [LibraryService] })
export class LibraryModule {}
