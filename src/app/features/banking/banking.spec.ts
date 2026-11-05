import { describe, expect, it } from 'vitest';
import {
  BankReconciliation,
  BankStatementLine,
  BookTransaction
} from '../../core/models/banking.model';

describe('Banking & Reconciliation Module Logic', () => {
  function calculateReconciliationBalances(
    openingBalance: number,
    statementBalance: number,
    statementLines: BankStatementLine[],
    bookTransactions: BookTransaction[]
  ) {
    const matchedBookLines = bookTransactions.filter(b => b.isReconciled);
    const totalDebits = matchedBookLines.reduce((sum, b) => sum + (b.debit || 0), 0);
    const totalCredits = matchedBookLines.reduce((sum, b) => sum + (b.credit || 0), 0);

    const clearedBookBalance = openingBalance + totalDebits - totalCredits;
    const difference = statementBalance - clearedBookBalance;
    const isBalanced = Math.abs(difference) < 0.001;

    return {
      clearedBookBalance: Math.round(clearedBookBalance * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      isBalanced,
      matchedCount: statementLines.filter(l => l.matchStatus === 'MATCHED').length,
      unmatchedStatementCount: statementLines.filter(l => l.matchStatus !== 'MATCHED').length,
      unmatchedBookCount: bookTransactions.filter(b => !b.isReconciled).length
    };
  }

  function autoMatchPairs(
    statementLines: BankStatementLine[],
    bookTransactions: BookTransaction[]
  ) {
    const matchedLines: BankStatementLine[] = [];
    const matchedBookIds = new Set<number>();

    for (const stmt of statementLines) {
      if (stmt.matchStatus === 'MATCHED') continue;

      const candidate = bookTransactions.find(book => {
        if (matchedBookIds.has(book.journalLineId) || book.isReconciled) return false;

        if (stmt.amount > 0) {
          // Deposit -> Book debit
          return Math.abs(stmt.amount - book.debit) < 0.001;
        } else if (stmt.amount < 0) {
          // Withdrawal -> Book credit
          return Math.abs(Math.abs(stmt.amount) - book.credit) < 0.001;
        }
        return false;
      });

      if (candidate) {
        stmt.matchedJournalLineId = candidate.journalLineId;
        stmt.matchStatus = 'MATCHED';
        candidate.isReconciled = true;
        matchedBookIds.add(candidate.journalLineId);
        matchedLines.push(stmt);
      }
    }

    return {
      matchedCount: matchedLines.length,
      reconciledTotal: matchedLines.reduce((acc, l) => acc + l.amount, 0)
    };
  }

  it('should enforce that difference must be 0.00 to complete reconciliation', () => {
    const stmtLines: BankStatementLine[] = [
      { id: 1, bankStatementId: 10, txnDate: '2026-10-15', description: 'Client Wire', reference: 'REF1', amount: 5000, matchStatus: 'MATCHED', matchedJournalLineId: 101 },
      { id: 2, bankStatementId: 10, txnDate: '2026-10-18', description: 'Bank Service Fee', reference: 'FEE', amount: -50, matchStatus: 'UNMATCHED' }
    ];

    const bookTxs: BookTransaction[] = [
      { journalLineId: 101, journalEntryId: 5, entryNo: 'RCP-001', entryDate: '2026-10-15', reference: 'REF1', description: 'Client Wire', debit: 5000, credit: 0, netAmount: 5000, isReconciled: true }
    ];

    // Initial opening: 1000, Statement balance: 5950 (1000 + 5000 - 50)
    const resultUnbalanced = calculateReconciliationBalances(1000, 5950, stmtLines, bookTxs);
    expect(resultUnbalanced.clearedBookBalance).toBe(6000);
    expect(resultUnbalanced.difference).toBe(-50);
    expect(resultUnbalanced.isBalanced).toBe(false);

    // After converting bank fee of 50 to journal entry
    bookTxs.push({
      journalLineId: 102,
      journalEntryId: 6,
      entryNo: 'JE-002',
      entryDate: '2026-10-18',
      reference: 'FEE',
      description: 'Bank Service Fee',
      debit: 0,
      credit: 50,
      netAmount: -50,
      isReconciled: true
    });
    stmtLines[1].matchStatus = 'MATCHED';
    stmtLines[1].matchedJournalLineId = 102;

    const resultBalanced = calculateReconciliationBalances(1000, 5950, stmtLines, bookTxs);
    expect(resultBalanced.clearedBookBalance).toBe(5950);
    expect(resultBalanced.difference).toBe(0);
    expect(resultBalanced.isBalanced).toBe(true);
    expect(resultBalanced.matchedCount).toBe(2);
    expect(resultBalanced.unmatchedStatementCount).toBe(0);
  });

  it('should auto-match statement lines with book transactions by amount', () => {
    const stmtLines: BankStatementLine[] = [
      { id: 1, bankStatementId: 10, txnDate: '2026-10-20', description: 'Deposit A', reference: 'DEP-A', amount: 1250.50, matchStatus: 'UNMATCHED' },
      { id: 2, bankStatementId: 10, txnDate: '2026-10-21', description: 'Supplier Wire', reference: 'PAY-B', amount: -3400.00, matchStatus: 'UNMATCHED' }
    ];

    const bookTxs: BookTransaction[] = [
      { journalLineId: 201, journalEntryId: 20, entryNo: 'RCP-10', entryDate: '2026-10-20', reference: 'DEP-A', description: 'Customer payment', debit: 1250.50, credit: 0, netAmount: 1250.50, isReconciled: false },
      { journalLineId: 202, journalEntryId: 21, entryNo: 'PAY-11', entryDate: '2026-10-21', reference: 'PAY-B', description: 'Vendor payment', debit: 0, credit: 3400.00, netAmount: -3400.00, isReconciled: false }
    ];

    const matchResult = autoMatchPairs(stmtLines, bookTxs);
    expect(matchResult.matchedCount).toBe(2);
    expect(stmtLines[0].matchStatus).toBe('MATCHED');
    expect(stmtLines[0].matchedJournalLineId).toBe(201);
    expect(stmtLines[1].matchStatus).toBe('MATCHED');
    expect(stmtLines[1].matchedJournalLineId).toBe(202);
    expect(bookTxs[0].isReconciled).toBe(true);
    expect(bookTxs[1].isReconciled).toBe(true);
  });
});

