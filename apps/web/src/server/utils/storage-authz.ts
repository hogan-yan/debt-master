/**
 * Per-resource authorization for storage objects (receipts, payment proofs).
 *
 * URL issuance used to require only *some* valid session, so one colleague
 * could enumerate numeric IDs and read every receipt in the system. Sessions
 * are now scoped by the access code they signed in with:
 *   - admins (better-auth / Authentik) may read everything;
 *   - a code bound to a colleague (`AccessCode.colleagueId`) may only read
 *     objects belonging to resources that involve that colleague;
 *   - an unbound code keeps legacy read access ONLY where explicitly allowed
 *     (dev by default; production denies unless `ALLOW_UNBOUND_CODE_READ=true`)
 *     — production always logs at least a warning, so operators are nudged to
 *     bind codes (bind via `assignAccessCodeColleague`).
 * The URLs themselves are additionally HMAC-signed and verified by the serve
 * route (`storage-signing.ts`).
 */
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { createServerLogger } from '@/server/infrastructure/logger';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode } from '@/utils/errors';

const logger = createServerLogger('storage-authz', process.env.NODE_ENV === 'development');

export const STORAGE_ACCESS_DENIED = 'You do not have access to this file';

/**
 * Resolve the storage scope of the current session.
 * `undefined` = unrestricted (admin, better-auth session, or unbound code).
 */
async function resolveBoundColleagueId(): Promise<number | undefined> {
  const auth = await getAuthFromCookie();
  if (!auth) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
  }
  if (auth.isAdmin || auth.accessCodeId === undefined) {
    return undefined;
  }

  const code = await prisma.accessCode.findUnique({
    where: { id: auth.accessCodeId },
    select: { colleagueId: true, isActive: true, deletedAt: true },
  });
  if (!code?.isActive || code.deletedAt) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
  }
  if (code.colleagueId === null) {
    // An unbound code means FULL read of every receipt/proof in the system.
    // That legacy behavior is now opt-in in production: deny by default so a
    // forgotten shared code cannot read the whole instance. Override with
    // ALLOW_UNBOUND_CODE_READ=true, or (better) bind the code to its
    // colleague.
    if (!unboundCodeReadAllowed()) {
      logger.warn('Storage denied: unbound access code (legacy full read disabled)', {
        accessCodeId: auth.accessCodeId,
      });
      throw new AppError(ErrorCode.STORAGE_ACCESS_DENIED, STORAGE_ACCESS_DENIED);
    }
    logger.warn('Storage access via unbound access code (legacy full read)', {
      accessCodeId: auth.accessCodeId,
    });
    return undefined;
  }
  return code.colleagueId;
}

/**
 * Whether legacy full-read for unbound access codes is enabled: explicit
 * `ALLOW_UNBOUND_CODE_READ` wins; otherwise allowed outside production and
 * denied in production.
 */
function unboundCodeReadAllowed(): boolean {
  const explicit = process.env.ALLOW_UNBOUND_CODE_READ;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function denyIfScoped(boundColleagueId: number | undefined, allowed: boolean): void {
  if (boundColleagueId === undefined) return;
  if (!allowed) {
    throw new AppError(ErrorCode.STORAGE_ACCESS_DENIED, STORAGE_ACCESS_DENIED);
  }
}

/**
 * Receipts live on an expense: a scoped colleague must be a participant.
 */
export async function assertExpenseObjectAccess(expenseId: number): Promise<void> {
  const boundColleagueId = await resolveBoundColleagueId();
  if (boundColleagueId === undefined) return;

  const participant = await prisma.expenseParticipant.findFirst({
    where: { expenseId, colleagueId: boundColleagueId },
    select: { id: true },
  });
  denyIfScoped(boundColleagueId, participant !== null);
}

/**
 * Payment proofs: a scoped colleague must own the payment (be the payer).
 */
export async function assertPaymentObjectAccess(payment: { colleagueId: number }): Promise<void> {
  const boundColleagueId = await resolveBoundColleagueId();
  if (boundColleagueId === undefined) return;

  denyIfScoped(boundColleagueId, payment.colleagueId === boundColleagueId);
}

/**
 * Legacy participant-based proof lookups: a scoped colleague must be that
 * exact participant.
 */
export async function assertParticipantObjectAccess(participant: {
  colleagueId: number;
}): Promise<void> {
  const boundColleagueId = await resolveBoundColleagueId();
  if (boundColleagueId === undefined) return;

  denyIfScoped(boundColleagueId, participant.colleagueId === boundColleagueId);
}
