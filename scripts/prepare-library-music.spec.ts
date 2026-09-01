import { LIBRARY_MUSIC_CATALOG } from '../prisma/library-music-catalog';
import {
  DEFAULT_THUMBNAIL_PERCENT,
  resolveThumbnailPercent,
  thumbnailTimestampSeconds,
} from './prepare-library-music';

describe('library music thumbnail timing', () => {
  it('uses 25% when the catalog does not configure an override', () => {
    expect(resolveThumbnailPercent({ code: 'default', thumbnailPercent: undefined })).toBe(
      DEFAULT_THUMBNAIL_PERCENT,
    );
  });

  it.each([10, 30, 70])('uses the configured %s%% override', (thumbnailPercent) => {
    expect(resolveThumbnailPercent({ code: 'override', thumbnailPercent })).toBe(thumbnailPercent);
  });

  it.each([0, -1, 100, 101, Number.NaN])(
    'rejects invalid thumbnail percent %s',
    (thumbnailPercent) => {
      expect(() => resolveThumbnailPercent({ code: 'invalid', thumbnailPercent })).toThrow(
        'thumbnailPercent inválido para invalid',
      );
    },
  );

  it('uses the real ffprobe duration to calculate the timestamp', () => {
    expect(thumbnailTimestampSeconds(104.08, 30)).toBeCloseTo(31.224, 6);
  });

  it('has no title-driven exception: only the manifest value changes the result', () => {
    expect(resolveThumbnailPercent({ code: 'same-code', thumbnailPercent: 70 })).toBe(70);
    expect(resolveThumbnailPercent({ code: 'same-code', thumbnailPercent: 30 })).toBe(30);
  });

  it('keeps exactly 18 catalog entries, with only the six approved overrides', () => {
    const overrides = LIBRARY_MUSIC_CATALOG.filter((item) => item.thumbnailPercent !== undefined);
    expect(LIBRARY_MUSIC_CATALOG).toHaveLength(18);
    expect(overrides.map((item) => [item.code, item.thumbnailPercent])).toEqual([
      ['music_bath_time_with_pupi', 30],
      ['music_gentle_good_night', 70],
      ['music_its_okay_to_fail', 10],
      ['music_pupis_cozy_hug', 30],
      ['music_i_can_do_it', 70],
      ['music_change_is_okay', 70],
    ]);
  });
});
