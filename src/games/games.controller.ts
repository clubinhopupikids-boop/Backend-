import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameCatalogItemDto, GameCatalogQueryDto } from './dto/game.dto';
import { GamesService } from './games.service';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List the game catalog; an empty catalog is valid' })
  @ApiOkResponse({ type: [GameCatalogItemDto] })
  list(@Query() query: GameCatalogQueryDto) {
    return this.service.list(query.category);
  }
}
