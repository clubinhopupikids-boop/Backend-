import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ChildrenService } from './children.service';
import { ChildDto, ChildIdParamDto, CreateChildDto, UpdateChildDto } from './dto/child.dto';

@ApiTags('children')
@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated responsible\'s children' })
  @ApiOkResponse({ type: [ChildDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.childrenService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a child profile for the authenticated responsible' })
  @ApiBody({ type: CreateChildDto })
  @ApiCreatedResponse({ type: ChildDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildDto) {
    return this.childrenService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a child owned by the authenticated responsible' })
  @ApiOkResponse({ type: ChildDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildIdParamDto) {
    return this.childrenService.getOwned(user.id, params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a child owned by the authenticated responsible' })
  @ApiBody({ type: UpdateChildDto })
  @ApiOkResponse({ type: ChildDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildIdParamDto,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childrenService.update(user.id, params.id, dto);
  }
}
