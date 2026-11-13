import type { Prisma } from '@prisma/client';

export interface CreateColleagueInput {
  name: string;
}

export interface CreateColleagueResult {
  id: number;
  name: string;
}

export async function createColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: CreateColleagueInput
): Promise<CreateColleagueResult> {
  const colleague = await tx.colleague.create({
    data: { name: input.name },
  });

  return {
    id: colleague.id,
    name: colleague.name,
  };
}
