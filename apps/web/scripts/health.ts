/**
 * Liveness/readiness probe endpoint (`/health`).
 *
 * Lives in scripts/ (not src/routes) so probes get a cheap raw response
 * instead of a full SSR page render — the previous probe target was `/`,
 * which exercised the whole React tree per probe. Verifies the database
 * round-trip so readiness flips before the app serves errors.
 *
 * Constructs the Prisma client with the v7 driver adapter explicitly —
 * a bare `new PrismaClient()` throws at first query under the v7
 * adapter setup, which made /health always answer `degraded` and smoke
 * roll back the deploy (2026-09-12). Cannot import the app's shared
 * client: the image ships `scripts/` + `dist/`, not `src/`.
 */
import { PrismaPg } from '@prisma/adapter-pg';

type PrismaClientLike = {
  $queryRaw: (query: TemplateStringsArray) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

let clientPromise: Promise<PrismaClientLike> | null = null;

function getClient(): Promise<PrismaClientLike> {
  if (!clientPromise) {
    clientPromise = import('@prisma/client').then(
      (mod) =>
        new mod.PrismaClient({
          adapter: new PrismaPg(
            process.env.DATABASE_URL || 'postgresql://localhost:5432/debtmaster'
          ),
        }) as PrismaClientLike
    );
  }
  return clientPromise;
}

let lastOkAt = 0;
const OK_CACHE_MS = 5000;
const DB_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<boolean> {
  if (Date.now() - lastOkAt < OK_CACHE_MS) return true;
  try {
    const client = await getClient();
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), DB_TIMEOUT_MS)),
    ]);
    lastOkAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

export async function handleHealth(): Promise<Response> {
  const dbUp = await checkDatabase();
  const body = JSON.stringify({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
  return new Response(body, {
    status: dbUp ? 200 : 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
