import { NotFoundException } from '@nestjs/common';
import { ExperienceSettingsService } from './experience-settings.service';
import { ChildrenService } from 'src/children/children.service';
import type { UpdateExperienceSettingsDto } from './dto/experience-settings.dto';

describe('ExperienceSettingsService', () => {
  let service: ExperienceSettingsService;
  let prisma: { experienceSettings: { findUnique: jest.Mock; update: jest.Mock } };
  let childrenService: { getOwned: jest.Mock };

  const mockSettings = {
    id: 's1',
    childId: 'c1',
    animationSpeed: 1.0,
    soundVolume: 0.8,
    visualStimulusLevel: 0.5,
    pupiResponseTime: 1.0,
    pupiSpeechFrequency: 0.5,
    instructionComplexity: 0.5,
    maxSimultaneousInteractiveElements: 3,
    narrationEnabled: true,
    musicEnabled: true,
    visualEffectsEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      experienceSettings: { findUnique: jest.fn(), update: jest.fn() },
    };
    childrenService = { getOwned: jest.fn() };
    service = new ExperienceSettingsService(
      prisma as unknown as never,
      childrenService as unknown as ChildrenService,
    );
  });

  describe('get', () => {
    it('verifies ownership before returning settings', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.experienceSettings.findUnique.mockResolvedValue(mockSettings);

      await service.get('r1', 'c1');

      expect(childrenService.getOwned).toHaveBeenCalledWith('r1', 'c1');
    });

    it('throws NotFound when child is not owned', async () => {
      childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));
      await expect(service.get('r2', 'c1')).rejects.toThrow('Child not found');
    });

    it('throws NotFound when settings do not exist (defensive)', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.experienceSettings.findUnique.mockResolvedValue(null);
      await expect(service.get('r1', 'c1')).rejects.toThrow('Experience settings not found');
    });
  });

  describe('update', () => {
    it('verifies ownership before updating', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.experienceSettings.update.mockResolvedValue(mockSettings);

      const dto: UpdateExperienceSettingsDto = { animationSpeed: 1.5 };
      await service.update('r1', 'c1', dto);

      expect(childrenService.getOwned).toHaveBeenCalledWith('r1', 'c1');
      expect(prisma.experienceSettings.update).toHaveBeenCalledWith({
        where: { childId: 'c1' },
        data: { animationSpeed: 1.5 },
      });
    });

    it('throws NotFound when child is not owned', async () => {
      childrenService.getOwned.mockRejectedValue(new NotFoundException('Child not found'));
      await expect(service.update('r2', 'c1', { soundVolume: 0.5 })).rejects.toThrow(
        'Child not found',
      );
    });

    it('only sends defined fields in the update', async () => {
      childrenService.getOwned.mockResolvedValue({ id: 'c1' });
      prisma.experienceSettings.update.mockResolvedValue(mockSettings);

      const dto: UpdateExperienceSettingsDto = {
        narrationEnabled: false,
        musicEnabled: false,
      };
      await service.update('r1', 'c1', dto);

      const updateData = prisma.experienceSettings.update.mock.calls[0][0].data;
      expect(updateData).toEqual({ narrationEnabled: false, musicEnabled: false });
      expect(updateData).not.toHaveProperty('animationSpeed');
    });
  });
});
