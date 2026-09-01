import { resolveAppHost } from './app.config';

describe('resolveAppHost', () => {
  it('binds production to loopback when HOST is omitted', () => {
    expect(resolveAppHost('production', undefined)).toBe('127.0.0.1');
  });

  it('keeps the development server reachable when HOST is omitted', () => {
    expect(resolveAppHost('development', undefined)).toBe('0.0.0.0');
  });

  it('respects an explicit HOST override', () => {
    expect(resolveAppHost('production', ' 10.0.0.5 ')).toBe('10.0.0.5');
  });
});
