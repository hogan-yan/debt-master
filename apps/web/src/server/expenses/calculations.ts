import { AppError, ErrorCode } from '@/utils/errors';

/**
 * Validate split data consistency
 * @throws Error if split type and data are inconsistent
 */
export const validateSplitData = (
  splitType: 'EQUAL' | 'ITEMIZED',
  amount: number,
  items?: Array<{ price: number; colleagueId: number; name?: string | undefined }>
): void => {
  if (splitType === 'ITEMIZED' && (!items || items.length === 0)) {
    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Itemized split requires items');
  }

  if (splitType === 'ITEMIZED' && items) {
    // Exact cents compare: 2-decimal inputs convert losslessly to integers
    const itemsTotalCents = items.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
    const amountCents = Math.round(amount * 100);
    if (itemsTotalCents !== amountCents) {
      throw new AppError(
        ErrorCode.VALIDATION_INVALID_INPUT,
        'Items total must equal expense amount'
      );
    }
  }
};

/**
 * Calculate equal split amounts for participants
 * Uses floor-based rounding with remainder distributed to first participant
 * to ensure splits sum exactly to the original amount (no penny loss/gain).
 */
export const calculateEqualSplit = (
  amount: number,
  participantIds: number[]
): Array<{ colleagueId: number; amount: number }> => {
  const count = participantIds.length;
  // Round down to cents per person
  const amountPerPerson = Math.floor((amount * 100) / count) / 100;
  // Assign remainder to first participant to avoid penny loss
  const remainder = Math.round((amount - amountPerPerson * count) * 100) / 100;

  return participantIds.map((colleagueId, index) => ({
    colleagueId,
    amount: index === 0 ? amountPerPerson + remainder : amountPerPerson,
  }));
};

/**
 * Calculate itemized split amounts by grouping items by colleague
 */
export const calculateItemizedSplit = (
  items: Array<{ price: number; colleagueId: number; name?: string | undefined }>
): Array<{ colleagueId: number; amount: number }> => {
  const colleagueAmounts = new Map<number, number>();

  for (const item of items) {
    const currentAmount = colleagueAmounts.get(item.colleagueId) || 0;
    colleagueAmounts.set(item.colleagueId, currentAmount + item.price);
  }

  return Array.from(colleagueAmounts.entries()).map(([colleagueId, amount]) => ({
    colleagueId,
    amount,
  }));
};
