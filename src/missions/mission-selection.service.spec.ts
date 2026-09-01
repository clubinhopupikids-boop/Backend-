import { MissionSelectionService } from './mission-selection.service';

describe('MissionSelectionService', () => {
  const random = { next: jest.fn(() => 0) };
  const service = new MissionSelectionService(random as never);

  beforeEach(() => random.next.mockReturnValue(0));

  it('avoids both prior mission ids and prior semantic groups while alternatives exist', () => {
    const selected = service.select(
      [
        { id: 'old-brush', exclusionGroup: 'ORAL_HYGIENE' },
        { id: 'new-brush', exclusionGroup: 'ORAL_HYGIENE' },
        { id: 'old-bed', exclusionGroup: 'BED_MAKING' },
        { id: 'fresh-1', exclusionGroup: null },
        { id: 'fresh-2', exclusionGroup: null },
      ],
      new Set(['old-brush']),
      new Set(['ORAL_HYGIENE']),
      3,
    );
    expect(selected.map((mission) => mission.id)).not.toContain('new-brush');
    expect(selected.map((mission) => mission.exclusionGroup).filter(Boolean)).toEqual(
      expect.arrayContaining(['BED_MAKING']),
    );
  });

  it('never puts two missions from the same exclusion group in one assignment set', () => {
    const selected = service.select(
      [
        { id: 'brush-a', exclusionGroup: 'ORAL_HYGIENE' },
        { id: 'brush-b', exclusionGroup: 'ORAL_HYGIENE' },
        { id: 'bed-a', exclusionGroup: 'BED_MAKING' },
        { id: 'free', exclusionGroup: null },
      ],
      new Set(),
      new Set(),
      5,
    );
    expect(selected).toHaveLength(3);
    expect(selected.filter((mission) => mission.exclusionGroup === 'ORAL_HYGIENE')).toHaveLength(1);
  });
});
