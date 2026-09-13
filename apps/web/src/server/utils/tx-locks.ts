import type { Prisma } from '@prisma/client';

/**
 * Transaction locking primitives.
 *
 * Money flows (payments, payment applications, claims) compute a balance from
 * rows they read, then write new rows. Under Prisma's default `READ COMMITTED`
 * isolation two concurrent flows for the same colleague can both read the same
 * stale balance and both write — the classic double-spend / lost-update window.
 *
 * These helpers acquire a Postgres row-level lock (`SELECT ... FOR UPDATE`) that
 * is held until the surrounding transaction commits or rolls back. Locking the
 * colleague row serializes every money mutation for that colleague: the second
 * concurrent flow blocks until the first commits, then re-reads the now-fresh
 * balance and applies the correct (possibly zero) amount. Different colleagues
 * never contend.
 *
 * Why colleague-level (not per-participant): a single prepayment can auto-apply
 * across many of a colleague's expense participants, and a claim can settle one
 * participant from any of the colleague's payments. The colleague is the common
 * denominator of every double-spend vector, so one lock covers them all with no
 * multi-row lock ordering (and therefore no deadlock risk).
 */

/**
 * Acquire an exclusive row-lock on the colleague for the duration of the
 * surrounding transaction. Call this BEFORE any balance read so the read sees
 * only data that no other concurrent flow can still change.
 *
 * @param tx - the active Prisma transaction client
 * @param colleagueId - colleague whose money flows should be serialized
 */
export async function lockColleagueForUpdate(
  tx: Prisma.TransactionClient,
  colleagueId: number
): Promise<void> {
  // NOTE: raw SQL bypasses Prisma's model mapping, so this uses the physical
  // table name (colleagues, via @@map in schema.prisma), not the model name.
  await tx.$queryRaw`SELECT 1 FROM colleagues WHERE id = ${colleagueId} FOR UPDATE`;
}

/**
 * Acquire the colleague row-lock, then run `work` under it. This is the
 * preferred way to guard a money flow: it makes the lock invariant structural —
 * the callback physically cannot run before the lock is held — so a workflow
 * composed of multiple read/write helpers cannot accidentally skip or reorder
 * the lock. Prefer this over a bare `lockColleagueForUpdate` followed by loose
 * code.
 *
 * The caller must resolve the `colleagueId` first (e.g. via a minimal
 * `select: { colleagueId: true }` lookup when only a participantId is known),
 * so the lock is acquired before any balance-relevant read.
 *
 * @param tx - the active Prisma transaction client
 * @param colleagueId - colleague whose money flows should be serialized
 * @param work - the balance reads/writes, run with the colleague lock held
 * @returns whatever `work` returns
 */
export async function withColleagueLock<T>(
  tx: Prisma.TransactionClient,
  colleagueId: number,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  await lockColleagueForUpdate(tx, colleagueId);
  return work(tx);
}
