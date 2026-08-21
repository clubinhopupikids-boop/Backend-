import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DevelopmentProfile, Language } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { CreateChildDto, UpdateChildDto, ChildDto } from './dto/child.dto';
import { calculateAge } from 'src/common/utils/calculate-age';
import { parseDateOnly } from 'src/common/validators/birth-date.validator';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async list(responsibleId: string): Promise<ChildDto[]> {
    const children = await this.prisma.child.findMany({
      where: { responsibleId },
      orderBy: { createdAt: 'desc' },
    });
    return children.map((c) => this.toDto(c));
  }

  async create(responsibleId: string, dto: CreateChildDto): Promise<ChildDto> {
    const birthDate = parseDateOnly(dto.birthDate)!;

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const child = await tx.child.create({
          data: {
            responsibleId,
            name: dto.name,
            birthDate,
            primaryLanguage: dto.primaryLanguage as Language,
            developmentProfile: (dto.developmentProfile as DevelopmentProfile | undefined) ?? null,
          },
        });
        await tx.experienceSettings.create({
          data: { childId: child.id },
        });
        return child;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new NotFoundException('Responsible not found');
      }
      throw err;
    }

    return this.toDto(created);
  }

  async getOwned(responsibleId: string, childId: string): Promise<ChildDto> {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, responsibleId },
    });
    if (!child) {
      throw new NotFoundException('Child not found');
    }
    return this.toDto(child);
  }

  async update(responsibleId: string, childId: string, dto: UpdateChildDto): Promise<ChildDto> {
    const existing = await this.prisma.child.findFirst({
      where: { id: childId, responsibleId },
    });
    if (!existing) {
      throw new NotFoundException('Child not found');
    }

    const data: Prisma.ChildUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.birthDate !== undefined) {
      data.birthDate = parseDateOnly(dto.birthDate)!;
    }
    if (dto.primaryLanguage !== undefined) {
      data.primaryLanguage = dto.primaryLanguage as Language;
    }
    if (dto.developmentProfile !== undefined) {
      data.developmentProfile = (dto.developmentProfile as DevelopmentProfile | null) ?? null;
    }
    if (Object.keys(data).length === 0) {
      throw new ConflictException('No updatable fields supplied');
    }

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data,
    });
    return this.toDto(updated);
  }

  private toDto(child: {
    id: string;
    name: string;
    birthDate: Date;
    primaryLanguage: string;
    developmentProfile: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ChildDto {
    return {
      id: child.id,
      name: child.name,
      birthDate: formatDate(child.birthDate),
      age: calculateAge(child.birthDate),
      primaryLanguage: child.primaryLanguage as ChildDto['primaryLanguage'],
      developmentProfile: child.developmentProfile as ChildDto['developmentProfile'],
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    };
  }
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
