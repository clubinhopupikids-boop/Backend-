import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from 'src/common/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ChildIdParamDto } from 'src/children/dto/child.dto';
import { ChildBalanceDto } from './dto/balance.dto';
import { EconomyService } from './economy.service';

@ApiTags('economy')
@Controller('children/:id/balance')
export class EconomyController {
  constructor(private readonly service: EconomyService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current balances of a child owned by the caller' })
  @ApiOkResponse({ type: ChildBalanceDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  getBalance(@CurrentUser() user: AuthenticatedUser, @Param() params: ChildIdParamDto) {
    return this.service.getBalance(user.id, params.id);
  }
}
