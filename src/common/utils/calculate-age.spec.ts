import { calculateAge } from './calculate-age';

describe('calculateAge', () => {
  const ref = new Date(2026, 7, 21);

  it('returns correct age when birthday already occurred this year', () => {
    const birth = new Date(2018, 2, 14);
    expect(calculateAge(birth, ref)).toBe(8);
  });

  it('returns correct age when birthday has NOT occurred yet this year', () => {
    const birth = new Date(2018, 11, 25);
    expect(calculateAge(birth, ref)).toBe(7);
  });

  it('returns correct age when birthday is exactly today', () => {
    const birth = new Date(2018, 7, 21);
    expect(calculateAge(birth, ref)).toBe(8);
  });

  it('returns negative age for a future birth date', () => {
    const birth = new Date(2030, 0, 1);
    expect(calculateAge(birth, ref)).toBe(-4);
  });

  it('returns 2 for a child under 3 years', () => {
    const birth = new Date(2024, 5, 1);
    expect(calculateAge(birth, ref)).toBe(2);
  });

  it('returns 15 for a child over 12 years', () => {
    const birth = new Date(2011, 0, 1);
    expect(calculateAge(birth, ref)).toBe(15);
  });

  it('returns 0 for a baby born this year', () => {
    const birth = new Date(2026, 3, 10);
    expect(calculateAge(birth, ref)).toBe(0);
  });

  it('handles year boundary — Dec 31 birth, Jan 1 ref', () => {
    const birth = new Date(2018, 11, 31);
    const reference = new Date(2026, 0, 1);
    expect(calculateAge(birth, reference)).toBe(7);
  });

  it('handles Jan 1 birth, Dec 31 ref', () => {
    const birth = new Date(2018, 0, 1);
    const reference = new Date(2026, 11, 31);
    expect(calculateAge(birth, reference)).toBe(8);
  });

  it('defaults to current date when reference is omitted', () => {
    const birth = new Date(2000, 0, 1);
    const age = calculateAge(birth);
    const now = new Date();
    let expected = now.getFullYear() - 2000;
    if (now.getMonth() < 0 || (now.getMonth() === 0 && now.getDate() < 1)) {
      expected--;
    }
    expect(age).toBe(expected);
  });
});
