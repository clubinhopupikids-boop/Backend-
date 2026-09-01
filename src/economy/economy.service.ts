import { Injectable } from '@nestjs/common';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import type { ChildBalanceDto } from './dto/balance.dto';

@Injectable()
export class EconomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
  ) {}

  async getBalance(responsibleId: string, childId: string): Promise<ChildBalanceDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: { starBalance: true, crystalBalance: true },
    });
    return { stars: child.starBalance, crystals: child.crystalBalance };
  }
}
