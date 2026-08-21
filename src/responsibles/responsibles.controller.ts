import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponsiblePublicDto } from 'src/auth/dto/register.dto';
import { ResponsiblesService } from './responsibles.service';

@ApiTags('account')
@Controller('me')
export class ResponsiblesController {
  constructor(private readonly responsiblesService: ResponsiblesService) {}

  @Get()
  @ApiOperation({ summary: 'Return the authenticated responsible profile' })
  @ApiOkResponse({ type: ResponsiblePublicDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<ResponsiblePublicDto> {
    return this.responsiblesService.findById(user.id);
  }
}
