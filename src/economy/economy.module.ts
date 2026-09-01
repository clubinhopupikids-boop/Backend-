import { Module } from '@nestjs/common';
import { ChildrenModule } from 'src/children/children.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

@Module({
  imports: [ChildrenModule],
  controllers: [EconomyController],
  providers: [EconomyService],
})
export class EconomyModule {}
