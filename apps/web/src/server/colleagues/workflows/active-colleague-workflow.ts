import type { Prisma } from '@prisma/client';

export type GetActiveColleaguesInput = Record<string, never>;

export interface GetActiveColleaguesResult {
  id: number;
  name: string;
  createdAt: Date;
}

export async function getActiveColleaguesWorkflow(
  tx: Prisma.TransactionClient
): Promise<GetActiveColleaguesResult[]> {
  const colleagues = await tx.colleague.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return colleagues.map((colleague) => ({
    id: colleague.id,
    name: colleague.name,
    createdAt: colleague.createdAt,
  }));
}
