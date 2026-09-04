import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  LibraryPlaybackContentParamsDto,
  LibraryPlaybackDto,
  LibraryPlaybackParamsDto,
  StartLibraryPlaybackDto,
} from './dto/library-playback.dto';
import { LibraryPlaybackService } from './library-playback.service';

@ApiTags('library')
@Controller('children/:childId/library')
export class LibraryPlaybackController {
  constructor(private readonly service: LibraryPlaybackService) {}

  @Post(':contentId/playbacks/start')
  @ApiOperation({ summary: 'Record a real start of a child library playback' })
  @ApiCreatedResponse({ type: LibraryPlaybackDto })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LibraryPlaybackContentParamsDto,
    @Body() dto: StartLibraryPlaybackDto,
  ) {
    return this.service.start(user.id, params.childId, params.contentId, dto);
  }

  @Post('playbacks/:playbackId/complete')
  @ApiOperation({ summary: 'Record natural completion of a child library playback' })
  @ApiCreatedResponse({ type: LibraryPlaybackDto })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LibraryPlaybackParamsDto,
  ) {
    return this.service.complete(user.id, params.childId, params.playbackId);
  }
}
