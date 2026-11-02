import { AbstractControl, FormArray, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface BalancedLinesValidationResult {
  minLines?: boolean;
  unbalanced?: boolean;
  invalidLineAmounts?: boolean;
  negativeAmounts?: boolean;
  totalDebit?: number;
  totalCredit?: number;
  difference?: number;
}

/**
 * Custom validator for Journal Entry forms enforcing double-entry balancing rules:
 * 1. At least two lines required.
 * 2. Total debit must equal total credit exactly.
 * 3. Each line must have either a positive debit or credit, never both.
 * 4. Line amounts cannot be negative.
 */
export const balancedLinesValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formGroup = control as FormGroup;
  const linesArray = formGroup.get('lines') as FormArray;

  if (!linesArray || linesArray.length < 2) {
    return { minLines: true };
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let hasInvalidLine = false;
  let hasNegativeAmount = false;

  for (let i = 0; i < linesArray.length; i++) {
    const lineGroup = linesArray.at(i);
    const debit = Number(lineGroup.get('debit')?.value) || 0;
    const credit = Number(lineGroup.get('credit')?.value) || 0;

    if (debit < 0 || credit < 0) {
      hasNegativeAmount = true;
    }

    const hasDebit = debit > 0;
    const hasCredit = credit > 0;

    // Line must have either debit or credit, not both, and not zero for both
    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      hasInvalidLine = true;
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  if (hasNegativeAmount) {
    return { negativeAmounts: true };
  }

  if (hasInvalidLine) {
    return { invalidLineAmounts: true };
  }

  // Precision check to 2 decimal places
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;
  const diff = Math.abs(roundedDebit - roundedCredit);

  if (diff >= 0.005 || roundedDebit === 0) {
    return {
      unbalanced: true,
      totalDebit: roundedDebit,
      totalCredit: roundedCredit,
      difference: diff
    };
  }

  return null;
};

