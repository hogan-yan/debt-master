import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrismaClient = vi.hoisted(() => vi.fn());
const mockPrismaPg = vi.hoisted(() => vi.fn());
const originalEnv = process.env;

vi.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: mockPrismaPg,
}));

// Function declarations (not arrows): the module calls `new PrismaPg(...)` /
// `new PrismaClient(...)`, so the implementations must be constructible.
// Function EXPRESSIONS would be rewritten to arrows by biome assist (arrows
// throw "is not a constructor" under `new`), and parameter properties are
// banned by erasableSyntaxOnly — declarations sidestep both.
function mockPrismaPgImpl(databaseUrl: string): { databaseUrl: string } {
  return { databaseUrl };
}
function mockPrismaClientImpl(options: unknown): { options: unknown } {
  return { options };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  Reflect.deleteProperty(globalThis, '__prisma');
  mockPrismaPg.mockImplementation(mockPrismaPgImpl);
  mockPrismaClient.mockImplementation(mockPrismaClientImpl);
});

afterEach(() => {
  process.env = originalEnv;
  Reflect.deleteProperty(globalThis, '__prisma');
});

describe('prisma server client', () => {
  it('uses the local default connection and caches the client outside production', async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'development';

    const { prisma } = await import('./index');

    expect(mockPrismaPg).toHaveBeenCalledWith('postgresql://localhost:5432/debtmaster');
    expect(mockPrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({ log: ['query', 'error', 'warn'] })
    );
    expect(Reflect.get(globalThis, '__prisma')).toBe(prisma);
  });

  it('uses the configured connection and does not populate the development cache in production', async () => {
    process.env.DATABASE_URL = 'postgresql://db.example.com:5432/debtmaster';
    process.env.NODE_ENV = 'production';

    await import('./index');

    expect(mockPrismaPg).toHaveBeenCalledWith('postgresql://db.example.com:5432/debtmaster');
    expect(mockPrismaClient).toHaveBeenCalledWith(expect.objectContaining({ log: ['error'] }));
    expect(Reflect.get(globalThis, '__prisma')).toBeUndefined();
  });
});
