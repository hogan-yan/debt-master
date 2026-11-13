import type { Prisma } from '@prisma/client';

export interface DeleteColleagueInput {
  id: number;
  deletedBy?: number;
}

export interface DeleteColleagueResult {
  id: number;
  name: string;
  deletedAt: Date | null;
}

export async function deleteColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: DeleteColleagueInput
): Promise<DeleteColleagueResult> {
  const data: Prisma.ColleagueUpdateInput = {
    deletedAt: new Date(),
  };

  if (input.deletedBy !== undefined) {
    data.deletedBy = input.deletedBy;
  }

  const colleague = await tx.colleague.update({
    where: { id: input.id },
    data,
  });

  return {
    id: colleague.id,
    name: colleague.name,
    deletedAt: colleague.deletedAt,
  };
}
