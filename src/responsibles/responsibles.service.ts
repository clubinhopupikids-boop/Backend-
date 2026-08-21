import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import type { ResponsiblePublicDto } from 'src/auth/dto/register.dto';

@Injectable()
export class ResponsiblesService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ResponsiblePublicDto> {
    const responsible = await this.prisma.responsible.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        language: true,
        termsAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!responsible) {
      throw new NotFoundException('Account not found');
    }
    return responsible;
  }
}
