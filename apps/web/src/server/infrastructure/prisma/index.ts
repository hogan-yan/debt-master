import { PrismaPg } from '@prisma/adapter-pg';
/**
 * Server-only Prisma Client instance
 * Uses Prisma v7 adapter pattern for database connections
 */
import { PrismaClient } from '@prisma/client';

// Safe global reference for server-only usage
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create adapter from DATABASE_URL (used by Prisma v7 client engine)
function getAdapter(databaseUrl: string): PrismaPg {
  return new PrismaPg(databaseUrl);
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    adapter: getAdapter(process.env.DATABASE_URL || 'postgresql://localhost:5432/debtmaster'),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Store in global only in development to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
