import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ChildrenService } from 'src/children/children.service';
import type { CommunicationModeDto } from './dto/communication-preferences.dto';

/**
 * Manages the N:N relation between a child and CommunicationMode. Ownership of
 * the child is verified before any read/write.
 */
@Injectable()
export class CommunicationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
  ) {}

  async list(responsibleId: string, childId: string): Promise<CommunicationModeDto[]> {
    await this.childrenService.getOwned(responsibleId, childId);
    const rows = await this.prisma.childCommunicationMode.findMany({
      where: { childId },
      include: { mode: true },
      orderBy: { mode: { code: 'asc' } },
    });
    return rows.map((r) => ({ code: r.mode.code, label: r.mode.label }));
  }

  async replace(
    responsibleId: string,
    childId: string,
    modeCodes: string[],
  ): Promise<CommunicationModeDto[]> {
    await this.childrenService.getOwned(responsibleId, childId);

    // Validate every requested code maps to a known modality.
    const uniqueCodes = Array.from(new Set(modeCodes.map((c) => c.trim()).filter(Boolean)));
    let modes: { id: string; code: string; label: string }[] = [];
    if (uniqueCodes.length > 0) {
      modes = await this.prisma.communicationMode.findMany({
        where: { code: { in: uniqueCodes } },
      });
      if (modes.length !== uniqueCodes.length) {
        const known = new Set(modes.map((m) => m.code));
        const unknown = uniqueCodes.filter((c) => !known.has(c));
        throw new BadRequestException(`Unknown communication mode codes: ${unknown.join(', ')}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.childCommunicationMode.deleteMany({ where: { childId } });
      if (modes.length > 0) {
        const createData: Prisma.ChildCommunicationModeCreateManyInput[] = modes.map((m) => ({
          childId,
          communicationModeId: m.id,
        }));
        await tx.childCommunicationMode.createMany({ data: createData });
      }
    });

    return this.list(responsibleId, childId);
  }
}
