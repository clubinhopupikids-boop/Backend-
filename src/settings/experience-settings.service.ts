import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ChildrenService } from 'src/children/children.service';
import type { UpdateExperienceSettingsDto } from './dto/experience-settings.dto';

/**
 * Manages a child's 1:1 ExperienceSettings. Ownership is verified through
 * ChildrenService before any read/write so a responsible can never touch
 * another responsible's child settings.
 */
@Injectable()
export class ExperienceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
  ) {}

  async get(responsibleId: string, childId: string) {
    await this.childrenService.getOwned(responsibleId, childId);
    const settings = await this.prisma.experienceSettings.findUnique({
      where: { childId },
    });
    if (!settings) {
      // Should never happen (created alongside child) — defensive guard.
      throw new NotFoundException('Experience settings not found');
    }
    return settings;
  }

  async update(responsibleId: string, childId: string, dto: UpdateExperienceSettingsDto) {
    await this.childrenService.getOwned(responsibleId, childId);
    const data: Prisma.ExperienceSettingsUpdateInput = {};
    if (dto.animationSpeed !== undefined) data.animationSpeed = dto.animationSpeed;
    if (dto.soundVolume !== undefined) data.soundVolume = dto.soundVolume;
    if (dto.visualStimulusLevel !== undefined) data.visualStimulusLevel = dto.visualStimulusLevel;
    if (dto.pupiResponseTime !== undefined) data.pupiResponseTime = dto.pupiResponseTime;
    if (dto.pupiSpeechFrequency !== undefined) data.pupiSpeechFrequency = dto.pupiSpeechFrequency;
    if (dto.instructionComplexity !== undefined) data.instructionComplexity = dto.instructionComplexity;
    if (dto.maxSimultaneousInteractiveElements !== undefined) {
      data.maxSimultaneousInteractiveElements = dto.maxSimultaneousInteractiveElements;
    }
    if (dto.narrationEnabled !== undefined) data.narrationEnabled = dto.narrationEnabled;
    if (dto.musicEnabled !== undefined) data.musicEnabled = dto.musicEnabled;
    if (dto.visualEffectsEnabled !== undefined) {
      data.visualEffectsEnabled = dto.visualEffectsEnabled;
    }
    return this.prisma.experienceSettings.update({
      where: { childId },
      data,
    });
  }
}
