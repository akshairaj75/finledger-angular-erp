import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { balancedLinesValidator } from './validators/balanced-lines.validator';

describe('Accounting Module - balancedLinesValidator', () => {
  function createJournalForm(lines: { debit: number; credit: number }[]): FormGroup {
    const lineGroups = lines.map(
      l =>
        new FormGroup({
          accountId: new FormControl(101),
          costCenterId: new FormControl(null),
          description: new FormControl(''),
          debit: new FormControl(l.debit),
          credit: new FormControl(l.credit)
        })
    );

    return new FormGroup(
      {
        lines: new FormArray(lineGroups)
      },
      { validators: [balancedLinesValidator] }
    );
  }

  it('should fail validation when there are fewer than two lines', () => {
    const form = createJournalForm([{ debit: 100, credit: 0 }]);
    expect(form.valid).toBe(false);
    expect(form.errors).toEqual({ minLines: true });
  });

  it('should fail validation when debits do not equal credits', () => {
    const form = createJournalForm([
      { debit: 100, credit: 0 },
      { debit: 0, credit: 80 }
    ]);
    expect(form.valid).toBe(false);
    expect(form.errors).toMatchObject({
      unbalanced: true,
      totalDebit: 100,
      totalCredit: 80,
      difference: 20
    });
  });

  it('should fail validation when both debit and credit are non-zero on the same line', () => {
    const form = createJournalForm([
      { debit: 100, credit: 50 },
      { debit: 0, credit: 50 }
    ]);
    expect(form.valid).toBe(false);
    expect(form.errors).toEqual({ invalidLineAmounts: true });
  });

  it('should fail validation when line amounts are negative', () => {
    const form = createJournalForm([
      { debit: -100, credit: 0 },
      { debit: 0, credit: -100 }
    ]);
    expect(form.valid).toBe(false);
    expect(form.errors).toEqual({ negativeAmounts: true });
  });

  it('should pass validation when debits equal credits with valid non-negative lines', () => {
    const form = createJournalForm([
      { debit: 250.5, credit: 0 },
      { debit: 0, credit: 250.5 }
    ]);
    expect(form.valid).toBe(true);
    expect(form.errors).toBeNull();
  });

  it('should pass validation for multi-line balanced entries', () => {
    const form = createJournalForm([
      { debit: 1000, credit: 0 },
      { debit: 0, credit: 950 },
      { debit: 0, credit: 50 }
    ]);
    expect(form.valid).toBe(true);
    expect(form.errors).toBeNull();
  });
});

