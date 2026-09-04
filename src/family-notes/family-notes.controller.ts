import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireParentAccess } from 'src/common/decorators/require-parent-access.decorator';
import {
  ChildFamilyNoteParamDto,
  ChildFamilyNotesParamDto,
  CreateFamilyNoteDto,
  FamilyNoteDto,
  FamilyNotesQueryDto,
  UpdateFamilyNoteDto,
} from './dto/family-note.dto';
import { FamilyNotesService } from './family-notes.service';

@ApiTags('family-notes')
@ApiHeader({ name: 'X-Parent-Access-Token', required: true })
@RequireParentAccess()
@Controller('children/:childId/family-notes')
export class FamilyNotesController {
  constructor(private readonly service: FamilyNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List private family notes for an owned child' })
  @ApiOkResponse({ type: [FamilyNoteDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildFamilyNotesParamDto,
    @Query() query: FamilyNotesQueryDto,
  ) {
    return this.service.list(user.id, params.childId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Register a private family moment for an owned child' })
  @ApiCreatedResponse({ type: FamilyNoteDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildFamilyNotesParamDto,
    @Body() dto: CreateFamilyNoteDto,
  ) {
    return this.service.create(user.id, params.childId, dto);
  }

  @Patch(':noteId')
  @ApiOperation({ summary: 'Edit a private family note for an owned child' })
  @ApiOkResponse({ type: FamilyNoteDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChildFamilyNoteParamDto,
    @Body() dto: UpdateFamilyNoteDto,
  ) {
    return this.service.update(user.id, params.childId, params.noteId, dto);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a private family note for an owned child' })
  @ApiNoContentResponse()
  delete(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildFamilyNoteParamDto) {
    return this.service.delete(user.id, params.childId, params.noteId);
  }
}
