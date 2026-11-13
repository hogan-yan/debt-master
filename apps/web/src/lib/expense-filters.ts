import type { Expense } from '@/types';

/**
 * Filter expenses by selected colleague IDs
 * Returns expenses where ANY of the selected colleagues is a participant (OR logic)
 *
 * @param expenses - Array of expenses to filter
 * @param selectedColleagueIds - Array of colleague IDs to filter by
 * @returns Filtered expenses where at least one selected colleague is a participant
 */
export function filterExpensesByColleagues(
  expenses: Expense[],
  selectedColleagueIds: number[]
): Expense[] {
  // Return all expenses if no colleagues selected
  if (selectedColleagueIds.length === 0) {
    return expenses;
  }

  const selectedIdSet = new Set(selectedColleagueIds);

  return expenses.filter((expense) => {
    const participants = expense.participants || [];
    return participants.some((participant) => {
      // Check colleagueId first, then fallback to colleague?.id
      const participantColleagueId = participant.colleagueId ?? participant.colleague?.id;
      return participantColleagueId !== undefined && selectedIdSet.has(participantColleagueId);
    });
  });
}

/**
 * Get unique colleagues from expenses for the filter dropdown
 * Only returns colleagues who have at least one expense transaction
 *
 * @param expenses - Array of expenses to extract colleagues from
 * @returns Array of unique colleagues sorted alphabetically by name
 */
export function getColleaguesFromExpenses(
  expenses: Expense[]
): Array<{ id: number; name: string }> {
  const colleagueMap = new Map<number, string>();

  for (const expense of expenses) {
    const participants = expense.participants || [];
    for (const participant of participants) {
      const colleague = participant.colleague;
      if (colleague) {
        const id = colleague.id ?? participant.colleagueId;
        if (id !== undefined && !colleagueMap.has(id)) {
          colleagueMap.set(id, colleague.name);
        }
      }
    }
  }

  // Convert to array and sort by name alphabetically
  const colleagues = Array.from(colleagueMap.entries()).map(([id, name]) => ({ id, name }));
  colleagues.sort((a, b) => a.name.localeCompare(b.name));

  return colleagues;
}
