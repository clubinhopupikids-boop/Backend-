import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LibraryContentDto, LibraryContentQueryDto } from './dto/library-content.dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@Controller('library/content')
export class LibraryController {
  constructor(private readonly service: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'List sensory-library content; an empty catalog is valid' })
  @ApiOkResponse({ type: [LibraryContentDto] })
  list(@Query() query: LibraryContentQueryDto) {
    return this.service.list(query.type);
  }
}
