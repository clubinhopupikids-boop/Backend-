import { EconomyService } from './economy.service';

describe('EconomyService', () => {
  const childrenService = { getOwned: jest.fn() };
  const prisma = { child: { findUniqueOrThrow: jest.fn() } };
  let service: EconomyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EconomyService(prisma as never, childrenService as never);
  });

  it('returns the persisted balance after ownership verification', async () => {
    childrenService.getOwned.mockResolvedValue({ id: 'child-1' });
    prisma.child.findUniqueOrThrow.mockResolvedValue({ starBalance: 14, crystalBalance: 3 });

    await expect(service.getBalance('responsible-1', 'child-1')).resolves.toEqual({
      stars: 14,
      crystals: 3,
    });
    expect(childrenService.getOwned).toHaveBeenCalledWith('responsible-1', 'child-1');
  });
});
