export type MatchStatus = 'UNMATCHED' | 'SUGGESTED' | 'MATCHED' | 'IGNORED';
export type ReconciliationStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface BankStatementLine {
  id: number;
  bankStatementId: number;
  txnDate: string;
  description: string;
  reference: string;
  amount: number;
  matchedJournalLineId?: number;
  matchStatus: MatchStatus;
}

export interface BookTransaction {
  journalLineId: number;
  journalEntryId: number;
  entryNo: string;
  entryDate: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  netAmount: number;
  isReconciled: boolean;
}

export interface BankReconciliation {
  id: number;
  bankAccountId: number;
  bankAccountName: string;
  glAccountId: number;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: ReconciliationStatus;
  completedAt?: string;
  statementLines: BankStatementLine[];
  bookTransactions: BookTransaction[];
  matchedCount: number;
  unmatchedStatementCount: number;
  unmatchedBookCount: number;
}

export interface StartReconciliationRequest {
  bankAccountId: number;
  statementDate: string;
  statementBalance: number;
}

export interface ReconciliationMatchRequest {
  statementLineId: number;
  journalLineId: number;
}

export interface BankChargeRequest {
  statementLineId: number;
  expenseAccountId?: number;
  description?: string;
}

export interface AutoMatchResult {
  matchedCount: number;
  reconciledTotal: number;
  remainingDifference: number;
  matchedLines: BankStatementLine[];
}

