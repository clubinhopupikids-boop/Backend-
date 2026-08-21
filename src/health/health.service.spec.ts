import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new HealthService(prisma as unknown as never);
  });

  it('returns ok when database is available', async () => {
    prisma.$queryRaw.mockResolvedValue(undefined);
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.app).toBe('pupikids-backend');
    expect(result.timestamp).toBeDefined();
  });

  it('returns down when database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.database.status).toBe('down');
    expect(result.database.error).toBeDefined();
  });

  it('does not expose connection strings or internal details', async () => {
    prisma.$queryRaw.mockResolvedValue(undefined);
    const result = await service.check();
    const json = JSON.stringify(result);

    expect(json).not.toContain('DATABASE_URL');
    expect(json).not.toContain('postgresql://');
    expect(json).not.toContain('password');
  });
});
