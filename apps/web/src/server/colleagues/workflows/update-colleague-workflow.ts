import type { Prisma } from '@prisma/client';

export interface UpdateColleagueInput {
  id: number;
  name: string;
}

export interface UpdateColleagueResult {
  id: number;
  name: string;
}

export async function updateColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: UpdateColleagueInput
): Promise<UpdateColleagueResult> {
  const colleague = await tx.colleague.update({
    where: { id: input.id },
    data: { name: input.name },
  });

  return {
    id: colleague.id,
    name: colleague.name,
  };
}
