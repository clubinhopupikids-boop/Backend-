import { parseDateOnly } from './birth-date.validator';

describe('parseDateOnly', () => {
  it('parses a valid YYYY-MM-DD date', () => {
    const d = parseDateOnly('2018-05-14');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2018);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(14);
  });

  it('returns null for invalid format', () => {
    expect(parseDateOnly('14/05/2018')).toBeNull();
    expect(parseDateOnly('2018-5-14')).toBeNull();
    expect(parseDateOnly('not-a-date')).toBeNull();
    expect(parseDateOnly('')).toBeNull();
  });

  it('returns null for impossible dates', () => {
    expect(parseDateOnly('2018-02-30')).toBeNull();
    expect(parseDateOnly('2018-13-01')).toBeNull();
    expect(parseDateOnly('2018-00-01')).toBeNull();
    expect(parseDateOnly('2018-01-00')).toBeNull();
  });

  it('handles leap year correctly', () => {
    expect(parseDateOnly('2024-02-29')).not.toBeNull();
    expect(parseDateOnly('2023-02-29')).toBeNull();
  });
});
