/**
 * Itemized split section — per-person item entry grid.
 * Pure presentation component extracted from expense-form.
 */

import { Plus, Trash2 } from 'lucide-react';
import React from 'react';
import { m } from '@/paraglide/messages';
import { EXPENSE_FORM, participantCheckboxId } from '@/test/test-ids';
import { Colleague } from '@/types';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import type { PersonItems } from './use-person-items';

interface ItemizedSplitSectionProps {
  colleagues: Colleague[];
  personItems: PersonItems[];
  togglePerson: (colleagueId: number) => void;
  addItem: (personIndex: number) => void;
  removeItem: (personIndex: number, itemIndex: number) => void;
  updateItem: (
    personIndex: number,
    itemIndex: number,
    field: 'name' | 'price',
    value: string | number
  ) => void;
}

export function ItemizedSplitSection({
  colleagues,
  personItems,
  togglePerson,
  addItem,
  removeItem,
  updateItem,
}: ItemizedSplitSectionProps): React.JSX.Element {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>{m.expense_form_selectParticipants()}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
          {colleagues.map((colleague) => (
            <div key={colleague.id} className="flex items-center space-x-2">
              <Checkbox
                id={`itemized-participant-${colleague.id}`}
                checked={personItems.some((person) => person.colleagueId === colleague.id)}
                onCheckedChange={() => togglePerson(colleague.id)}
                data-testid={participantCheckboxId(colleague.id)}
              />
              <Label htmlFor={`itemized-participant-${colleague.id}`}>{colleague.name}</Label>
            </div>
          ))}
        </div>
      </div>

      {personItems.length > 0 && (
        <div className="grid gap-4">
          <Label>{m.expense_form_addItemsForEachPerson()}</Label>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {personItems.map((person, personIndex) => {
              const colleague = colleagues.find((c) => c.id === person.colleagueId);
              return (
                <div key={person.colleagueId} className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">{colleague?.name}</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(personIndex)}
                      className="flex items-center gap-1"
                      data-testid={EXPENSE_FORM.ADD_ITEM_BTN}
                    >
                      <Plus className="h-4 w-4" />
                      {m.expense_form_addItem()}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {person.items.map((item, itemIndex) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2">
                        <div className="col-span-7">
                          <label
                            htmlFor={`item-name-${personIndex}-${itemIndex}`}
                            className="sr-only"
                          >
                            {m.expense_form_itemName()}
                          </label>
                          <input
                            id={`item-name-${personIndex}-${itemIndex}`}
                            type="text"
                            placeholder={m.expense_form_placeholder_itemName()}
                            value={item.name}
                            onChange={(e) =>
                              updateItem(personIndex, itemIndex, 'name', e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            data-testid={EXPENSE_FORM.ITEM_NAME_INPUT}
                          />
                        </div>
                        <div className="col-span-4">
                          <label
                            htmlFor={`item-price-${personIndex}-${itemIndex}`}
                            className="sr-only"
                          >
                            {m.expense_form_itemPrice()}
                          </label>
                          <input
                            id={`item-price-${personIndex}-${itemIndex}`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={item.price || ''}
                            onChange={(e) =>
                              updateItem(personIndex, itemIndex, 'price', e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            data-testid={EXPENSE_FORM.ITEM_PRICE_INPUT}
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(personIndex, itemIndex)}
                            disabled={person.items.length === 1}
                            className="p-1 h-8 w-8 text-destructive-text hover:text-destructive-text"
                            aria-label={m.expense_form_deleteItem()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t bg-background rounded p-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{m.expense_form_personTotal({ name: colleague?.name || '' })}</span>
                      <span className="font-medium">
                        ${person.items.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-info/10 p-3 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span>{m.expense_form_grandTotal()}</span>
              <span className="font-medium text-lg">
                $
                {personItems
                  .reduce(
                    (sum, person) =>
                      sum + person.items.reduce((itemSum, item) => itemSum + (item.price || 0), 0),
                    0
                  )
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
