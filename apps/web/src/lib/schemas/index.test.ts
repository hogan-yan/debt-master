/// <reference types="vitest/globals" />

import { adminLoginSchema, colleagueLoginSchema, loginFormSchema } from './auth';
import { colleagueSchema, createColleagueSchema } from './colleague';
// Import all schemas
import { createExpenseSchema, expenseSchema } from './expense';
import { paymentSchema } from './payment';
import { createRestaurantSchema, restaurantSchema, updateRestaurantSchema } from './restaurant';

describe('expenseSchema', () => {
  const validExpense = {
    date: '2024-06-15',
    restaurantId: '1',
    amount: '50.00',
    splitType: 'EQUAL' as const,
    participantIds: ['1', '2'],
    notes: 'Team lunch',
  };

  it('should validate a valid expense', () => {
    const result = expenseSchema.parse(validExpense);
    expect(result).toEqual({
      date: '2024-06-15',
      restaurantId: '1',
      amount: '50.00',
      splitType: 'EQUAL',
      participantIds: ['1', '2'],
      notes: 'Team lunch',
    });
  });

  it('should reject empty date', () => {
    const invalid = { ...validExpense, date: '' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Date is required');
  });

  it('should reject missing date', () => {
    const { date: _, ...invalid } = validExpense;
    expect(() => expenseSchema.parse(invalid)).toThrow('Date is required');
  });

  it('should reject empty restaurantId', () => {
    const invalid = { ...validExpense, restaurantId: '' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Restaurant is required');
  });

  it('should reject empty amount', () => {
    const invalid = { ...validExpense, amount: '' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Amount is required');
  });

  it('should reject zero amount', () => {
    const invalid = { ...validExpense, amount: '0' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Amount must be greater than 0');
  });

  it('should reject negative amount', () => {
    const invalid = { ...validExpense, amount: '-10' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Amount must be greater than 0');
  });

  it('should reject invalid amount format', () => {
    const invalid = { ...validExpense, amount: 'abc' };
    expect(() => expenseSchema.parse(invalid)).toThrow('Amount must be greater than 0');
  });

  it('should reject invalid split type', () => {
    const invalid = { ...validExpense, splitType: 'INVALID' };
    expect(() => expenseSchema.parse(invalid)).toThrow();
  });

  it('should accept ITEMIZED split type', () => {
    const valid = { ...validExpense, splitType: 'ITEMIZED' as const };
    const result = expenseSchema.parse(valid);
    expect(result.splitType).toBe('ITEMIZED');
  });

  it('should reject empty participantIds', () => {
    const invalid = { ...validExpense, participantIds: [] };
    expect(() => expenseSchema.parse(invalid)).toThrow('At least one participant is required');
  });

  it('should accept optional notes', () => {
    // Omit notes to test the schema's handling of missing optional field
    const { notes: _notes, ...withoutNotes } = validExpense;
    const result = expenseSchema.parse(withoutNotes);
    expect(result.notes).toBeUndefined();
  });

  it('should accept empty notes', () => {
    const valid = { ...validExpense, notes: '' };
    const result = expenseSchema.parse(valid);
    expect(result.notes).toBe('');
  });
});

describe('createExpenseSchema', () => {
  it('should transform and trim notes', () => {
    const input = {
      date: '2024-06-15',
      restaurantId: '1',
      amount: '50.00',
      splitType: 'EQUAL' as const,
      participantIds: ['1'],
      notes: '  Team lunch  ',
    };

    const result = createExpenseSchema.parse(input);
    expect(result.notes).toBe('Team lunch');
  });

  it('should convert empty notes to undefined', () => {
    const input = {
      date: '2024-06-15',
      restaurantId: '1',
      amount: '50.00',
      splitType: 'EQUAL' as const,
      participantIds: ['1'],
      notes: '   ',
    };

    const result = createExpenseSchema.parse(input);
    expect(result.notes).toBeUndefined();
  });
});

describe('paymentSchema', () => {
  const validPayment = {
    colleagueId: '1',
    amount: '100.00',
    date: '2024-06-15',
    paymentType: 'CASH' as const,
  };

  it('should validate a valid payment', () => {
    const result = paymentSchema.parse(validPayment);
    expect(result).toEqual({
      colleagueId: '1',
      amount: '100.00',
      date: '2024-06-15',
      paymentType: 'CASH',
    });
  });

  it('should reject empty colleagueId', () => {
    const invalid = { ...validPayment, colleagueId: '' };
    expect(() => paymentSchema.parse(invalid)).toThrow('Colleague is required');
  });

  it('should reject missing colleagueId', () => {
    const invalid: Partial<typeof validPayment> = { ...validPayment };
    invalid.colleagueId = undefined;
    expect(() => paymentSchema.parse(invalid)).toThrow('Colleague is required');
  });

  it('should reject empty amount', () => {
    const invalid = { ...validPayment, amount: '' };
    expect(() => paymentSchema.parse(invalid)).toThrow('Amount is required');
  });

  it('should reject zero amount', () => {
    const invalid = { ...validPayment, amount: '0' };
    expect(() => paymentSchema.parse(invalid)).toThrow('Amount must be greater than 0');
  });

  it('should reject negative amount', () => {
    const invalid = { ...validPayment, amount: '-50' };
    expect(() => paymentSchema.parse(invalid)).toThrow('Amount must be greater than 0');
  });

  it('should reject empty date', () => {
    const invalid = { ...validPayment, date: '' };
    expect(() => paymentSchema.parse(invalid)).toThrow('Date is required');
  });

  it('should reject invalid payment type', () => {
    const invalid = { ...validPayment, paymentType: 'INVALID' };
    expect(() => paymentSchema.parse(invalid)).toThrow();
  });

  it('should accept all valid payment types', () => {
    const types = ['PAYME', 'FPS', 'CASH', 'OTHER'] as const;
    types.forEach((type) => {
      const valid = { ...validPayment, paymentType: type };
      const result = paymentSchema.parse(valid);
      expect(result.paymentType).toBe(type);
    });
  });

  it('should accept optional file upload', () => {
    const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
    const valid = { ...validPayment, paymentProofFile: file };
    const result = paymentSchema.parse(valid);
    expect(result.paymentProofFile).toBe(file);
  });

  it('should accept optional expenseId', () => {
    const valid = { ...validPayment, expenseId: 123 };
    const result = paymentSchema.parse(valid);
    expect(result.expenseId).toBe(123);
  });

  it('should reject negative expenseId', () => {
    const invalid = { ...validPayment, expenseId: -1 };
    expect(() => paymentSchema.parse(invalid)).toThrow();
  });

  it('should accept optional restaurantId', () => {
    const valid = { ...validPayment, restaurantId: 456 };
    const result = paymentSchema.parse(valid);
    expect(result.restaurantId).toBe(456);
  });

  it('should accept optional flags', () => {
    const valid = {
      ...validPayment,
      keepExistingProof: true,
      removeExistingProof: false,
    };
    const result = paymentSchema.parse(valid);
    expect(result.keepExistingProof).toBe(true);
    expect(result.removeExistingProof).toBe(false);
  });

  it('should accept optional selectedExpenseIds', () => {
    const valid = { ...validPayment, selectedExpenseIds: [1, 2, 3] };
    const result = paymentSchema.parse(valid);
    expect(result.selectedExpenseIds).toEqual([1, 2, 3]);
  });

  it('should accept optional expenseAmounts', () => {
    const valid = {
      ...validPayment,
      expenseAmounts: { '1': '50.00', '2': '25.00' },
    };
    const result = paymentSchema.parse(valid);
    expect(result.expenseAmounts).toEqual({ '1': '50.00', '2': '25.00' });
  });
});

describe('colleagueSchema', () => {
  it('should validate a valid colleague name', () => {
    const result = colleagueSchema.parse({ name: 'John Doe' });
    expect(result.name).toBe('John Doe');
  });

  it('should reject empty name', () => {
    expect(() => colleagueSchema.parse({ name: '' })).toThrow('Name is required');
  });

  it('should reject missing name', () => {
    expect(() => colleagueSchema.parse({})).toThrow('Name is required');
  });

  it('should reject short name (less than 2 chars)', () => {
    expect(() => colleagueSchema.parse({ name: 'A' })).toThrow('at least 2 characters');
  });

  it('should accept exactly 2 characters', () => {
    const result = colleagueSchema.parse({ name: 'Jo' });
    expect(result.name).toBe('Jo');
  });
});

describe('createColleagueSchema', () => {
  it('should trim the name', () => {
    const result = createColleagueSchema.parse({ name: '  John Doe  ' });
    expect(result.name).toBe('John Doe');
  });

  it('should handle internal whitespace', () => {
    const result = createColleagueSchema.parse({ name: 'John   Doe' });
    expect(result.name).toBe('John   Doe'); // Only trims ends
  });
});

describe('restaurantSchema', () => {
  const validRestaurant = {
    name: 'Burger King',
    address: '123 Main St',
  };

  it('should validate a valid restaurant', () => {
    const result = restaurantSchema.parse(validRestaurant);
    expect(result.name).toBe('Burger King');
    expect(result.address).toBe('123 Main St');
  });

  it('should validate without address', () => {
    const withoutAddress: Partial<typeof validRestaurant> = { ...validRestaurant };
    withoutAddress.address = undefined;
    const result = restaurantSchema.parse(withoutAddress);
    expect(result.name).toBe('Burger King');
    expect(result.address).toBeUndefined();
  });

  it('should reject empty name', () => {
    const invalid = { ...validRestaurant, name: '' };
    expect(() => restaurantSchema.parse(invalid)).toThrow('Restaurant name is required');
  });

  it('should reject name over 100 characters', () => {
    const invalid = { ...validRestaurant, name: 'A'.repeat(101) };
    expect(() => restaurantSchema.parse(invalid)).toThrow('less than 100 characters');
  });

  it('should accept exactly 100 characters', () => {
    const valid = { ...validRestaurant, name: 'A'.repeat(100) };
    const result = restaurantSchema.parse(valid);
    expect(result.name).toBe('A'.repeat(100));
  });

  it('should trim the name', () => {
    const result = restaurantSchema.parse({ name: '  Burger King  ' });
    expect(result.name).toBe('Burger King');
  });

  it('should convert empty string address to undefined', () => {
    const result = restaurantSchema.parse({ name: 'Test', address: '' });
    expect(result.address).toBeUndefined();
  });
});

describe('createRestaurantSchema', () => {
  const validCreate = {
    name: 'Burger King',
    address: '123 Main Street',
  };

  it('should validate a valid restaurant creation', () => {
    const result = createRestaurantSchema.parse(validCreate);
    expect(result.name).toBe('Burger King');
    expect(result.address).toBe('123 Main Street');
    expect(result.cuisine).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('should reject empty name', () => {
    const invalid = { ...validCreate, name: '' };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('Restaurant name is required');
  });

  it('should reject short name (less than 2 chars)', () => {
    const invalid = { ...validCreate, name: 'A' };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('at least 2 characters');
  });

  it('should reject name over 100 characters', () => {
    const invalid = { ...validCreate, name: 'A'.repeat(101) };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('less than 100 characters');
  });

  it('should reject empty address', () => {
    const invalid = { ...validCreate, address: '' };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('Address is required');
  });

  it('should reject short address (less than 5 chars)', () => {
    const invalid = { ...validCreate, address: '123' };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('at least 5 characters');
  });

  it('should reject address over 200 characters', () => {
    const invalid = { ...validCreate, address: 'A'.repeat(201) };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('less than 200 characters');
  });

  it('should trim inputs', () => {
    const result = createRestaurantSchema.parse({
      name: '  Burger King  ',
      address: '  123 Main St  ',
    });
    expect(result.name).toBe('Burger King');
    expect(result.address).toBe('123 Main St');
  });

  it('should accept optional cuisine', () => {
    const result = createRestaurantSchema.parse({
      ...validCreate,
      cuisine: 'japanese',
    });
    expect(result.cuisine).toBe('japanese');
  });

  it('should accept creation without cuisine', () => {
    const result = createRestaurantSchema.parse(validCreate);
    expect(result.cuisine).toBeUndefined();
  });

  it('should reject invalid cuisine value', () => {
    const invalid = { ...validCreate, cuisine: 'Fusion' };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow();
  });

  it('should convert empty cuisine string to undefined', () => {
    const result = createRestaurantSchema.parse({
      ...validCreate,
      cuisine: '',
    });
    expect(result.cuisine).toBeUndefined();
  });

  it('should accept optional notes', () => {
    const result = createRestaurantSchema.parse({
      ...validCreate,
      notes: 'Great sushi',
    });
    expect(result.notes).toBe('Great sushi');
  });

  it('should accept creation without notes', () => {
    const result = createRestaurantSchema.parse(validCreate);
    expect(result.notes).toBeUndefined();
  });

  it('should reject notes over 500 characters', () => {
    const invalid = { ...validCreate, notes: 'A'.repeat(501) };
    expect(() => createRestaurantSchema.parse(invalid)).toThrow('less than 500 characters');
  });

  it('should trim notes', () => {
    const result = createRestaurantSchema.parse({
      ...validCreate,
      notes: '  Great sushi  ',
    });
    expect(result.notes).toBe('Great sushi');
  });
});

describe('updateRestaurantSchema', () => {
  const validUpdate = {
    id: 1,
    name: 'Updated Name',
    address: 'Updated Address',
  };

  it('should validate a valid restaurant update', () => {
    const result = updateRestaurantSchema.parse(validUpdate);
    expect(result.id).toBe(1);
    expect(result.name).toBe('Updated Name');
    expect(result.address).toBe('Updated Address');
  });

  it('should require positive integer id', () => {
    const invalid = { ...validUpdate, id: 0 };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow();
  });

  it('should reject negative id', () => {
    const invalid = { ...validUpdate, id: -1 };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow();
  });

  it('should accept partial updates (name only)', () => {
    const partial = { id: 1, name: 'New Name' };
    const result = updateRestaurantSchema.parse(partial);
    expect(result.id).toBe(1);
    expect(result.name).toBe('New Name');
    expect(result.address).toBeUndefined();
  });

  it('should accept partial updates (address only)', () => {
    const partial = { id: 1, address: 'New Address' };
    const result = updateRestaurantSchema.parse(partial);
    expect(result.id).toBe(1);
    expect(result.address).toBe('New Address');
    expect(result.name).toBeUndefined();
  });

  it('should reject short name in update', () => {
    const invalid = { id: 1, name: 'A' };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow('at least 2 characters');
  });

  it('should reject long address in update', () => {
    const invalid = { id: 1, address: 'A'.repeat(201) };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow('less than 200 characters');
  });

  it('should accept optional cuisine in update', () => {
    const result = updateRestaurantSchema.parse({ id: 1, cuisine: 'italian' });
    expect(result.cuisine).toBe('italian');
  });

  it('should accept update without cuisine', () => {
    const result = updateRestaurantSchema.parse({ id: 1, name: 'Test' });
    expect(result.cuisine).toBeUndefined();
  });

  it('should reject invalid cuisine value in update', () => {
    const invalid = { id: 1, cuisine: 'Fusion' };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow();
  });

  it('should accept optional notes in update', () => {
    const result = updateRestaurantSchema.parse({ id: 1, notes: 'Nice place' });
    expect(result.notes).toBe('Nice place');
  });

  it('should reject notes over 500 characters in update', () => {
    const invalid = { id: 1, notes: 'A'.repeat(501) };
    expect(() => updateRestaurantSchema.parse(invalid)).toThrow('less than 500 characters');
  });
});

describe('colleagueLoginSchema', () => {
  it('should validate a valid access code', () => {
    const result = colleagueLoginSchema.parse({ accessCode: '1234' });
    expect(result.accessCode).toBe('1234');
  });

  it('should reject empty access code', () => {
    expect(() => colleagueLoginSchema.parse({ accessCode: '' })).toThrow('Access code is required');
  });

  it('should reject short access code (less than 4 chars)', () => {
    expect(() => colleagueLoginSchema.parse({ accessCode: '123' })).toThrow(
      'at least 4 characters'
    );
  });

  it('should reject long access code (over 50 chars)', () => {
    const longCode = 'A'.repeat(51);
    expect(() => colleagueLoginSchema.parse({ accessCode: longCode })).toThrow(
      'must not exceed 50 characters'
    );
  });

  it('should accept exactly 50 characters', () => {
    const code = 'A'.repeat(50);
    const result = colleagueLoginSchema.parse({ accessCode: code });
    expect(result.accessCode).toBe(code);
  });
});

describe('adminLoginSchema', () => {
  it('should validate a valid username', () => {
    const result = adminLoginSchema.parse({ username: 'admin' });
    expect(result.username).toBe('admin');
  });

  it('should reject empty username', () => {
    expect(() => adminLoginSchema.parse({ username: '' })).toThrow('Username is required');
  });

  it('should reject short username (less than 2 chars)', () => {
    expect(() => adminLoginSchema.parse({ username: 'A' })).toThrow('at least 2 characters');
  });

  it('should reject long username (over 50 chars)', () => {
    const longName = 'A'.repeat(51);
    expect(() => adminLoginSchema.parse({ username: longName })).toThrow(
      'must not exceed 50 characters'
    );
  });
});

describe('loginFormSchema', () => {
  it('should validate with access code only', () => {
    const result = loginFormSchema.parse({ accessCode: '1234' });
    expect(result.accessCode).toBe('1234');
    expect(result.turnstileToken).toBeUndefined();
  });

  it('should reject short access code', () => {
    expect(() => loginFormSchema.parse({ accessCode: '123' })).toThrow('at least 4 characters');
  });

  it('should reject long access code', () => {
    const longCode = 'A'.repeat(51);
    expect(() => loginFormSchema.parse({ accessCode: longCode })).toThrow(
      'must not exceed 50 characters'
    );
  });

  it('should accept with turnstile token', () => {
    const valid = { accessCode: '1234', turnstileToken: 'token123' };
    const result = loginFormSchema.parse(valid);
    expect(result.accessCode).toBe('1234');
    expect(result.turnstileToken).toBe('token123');
  });

  it('should accept without turnstile token (optional)', () => {
    const result = loginFormSchema.parse({ accessCode: '1234' });
    expect(result.accessCode).toBe('1234');
    expect(result.turnstileToken).toBeUndefined();
  });
});
