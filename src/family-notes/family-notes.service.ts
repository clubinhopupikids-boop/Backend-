import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FamilyNote, Prisma } from '@prisma/client';
import { ChildrenService } from 'src/children/children.service';
import { PrismaService } from 'src/database/prisma.service';
import type {
  CreateFamilyNoteDto,
  FamilyNoteDto,
  FamilyNotesQueryDto,
  UpdateFamilyNoteDto,
} from './dto/family-note.dto';

const FAMILY_NOTES_LIMIT = 100;

@Injectable()
export class FamilyNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
  ) {}

  async list(
    responsibleId: string,
    childId: string,
    query: FamilyNotesQueryDto,
  ): Promise<FamilyNoteDto[]> {
    await this.childrenService.getOwned(responsibleId, childId);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) {
      throw new BadRequestException('from must be earlier than to');
    }

    const observedAt: Prisma.DateTimeFilter | undefined =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
    const notes = await this.prisma.familyNote.findMany({
      where: { responsibleId, childId, ...(observedAt ? { observedAt } : {}) },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
      take: FAMILY_NOTES_LIMIT,
    });
    return notes.map(toDto);
  }

  async create(
    responsibleId: string,
    childId: string,
    dto: CreateFamilyNoteDto,
  ): Promise<FamilyNoteDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const data = {
      responsibleId,
      childId,
      clientRequestId: dto.clientRequestId,
      text: normalizedText(dto.text),
      observedAt: dto.observedAt ? new Date(dto.observedAt) : new Date(),
    };
    const note = await this.prisma.familyNote.upsert({
      where: {
        responsibleId_childId_clientRequestId: {
          responsibleId,
          childId,
          clientRequestId: dto.clientRequestId,
        },
      },
      create: data,
      update: {},
    });
    return toDto(note);
  }

  async update(
    responsibleId: string,
    childId: string,
    noteId: string,
    dto: UpdateFamilyNoteDto,
  ): Promise<FamilyNoteDto> {
    await this.childrenService.getOwned(responsibleId, childId);
    const result = await this.prisma.familyNote.updateMany({
      where: { id: noteId, childId, responsibleId },
      data: { text: normalizedText(dto.text) },
    });
    if (result.count === 0) throw new NotFoundException('Family note not found');
    const note = await this.prisma.familyNote.findUniqueOrThrow({ where: { id: noteId } });
    return toDto(note);
  }

  async delete(responsibleId: string, childId: string, noteId: string): Promise<void> {
    await this.childrenService.getOwned(responsibleId, childId);
    const result = await this.prisma.familyNote.deleteMany({
      where: { id: noteId, childId, responsibleId },
    });
    if (result.count === 0) throw new NotFoundException('Family note not found');
  }
}

function normalizedText(value: string): string {
  const text = value.trim();
  if (!text) throw new BadRequestException('Family note text cannot be empty');
  return text;
}

function toDto(note: FamilyNote): FamilyNoteDto {
  return {
    id: note.id,
    childId: note.childId,
    text: note.text,
    observedAt: note.observedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
