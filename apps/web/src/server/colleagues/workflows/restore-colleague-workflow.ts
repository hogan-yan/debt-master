import type { Prisma } from '@prisma/client';

export interface RestoreColleagueInput {
  id: number;
}

export interface RestoreColleagueResult {
  id: number;
  name: string;
}

export async function restoreColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: RestoreColleagueInput
): Promise<RestoreColleagueResult> {
  const colleague = await tx.colleague.update({
    where: { id: input.id },
    data: { deletedAt: null, deletedBy: null },
  });

  return {
    id: colleague.id,
    name: colleague.name,
  };
}
