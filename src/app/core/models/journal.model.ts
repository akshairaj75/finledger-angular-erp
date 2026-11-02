export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID';

export type JournalSourceType =
  | 'MANUAL'
  | 'INVOICE'
  | 'BILL'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CREDIT_NOTE'
  | 'EXPENSE'
  | 'REIMBURSEMENT'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'OPENING'
  | 'CLOSING';

export type PartyType = 'CUSTOMER' | 'VENDOR';

export interface JournalLine {
  id?: number;
  lineNo?: number;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  costCenterId?: number;
  description?: string;
  debit: number;
  credit: number;
  baseDebit?: number;
  baseCredit?: number;
  partyType?: PartyType;
  partyId?: number;
  isReconciled?: boolean;
}

export interface JournalEntry {
  id: number;
  companyId: number;
  entryNo: string;
  entryDate: string;
  fiscalPeriodId: number;
  reference?: string;
  narration?: string;
  sourceType: JournalSourceType;
  sourceId?: number;
  currencyCode: string;
  exchangeRate: number;
  totalDebit: number;
  totalCredit: number;
  status: JournalStatus;
  postedAt?: string;
  postedBy?: number;
  reversalOfId?: number;
  lines: JournalLine[];
}

export interface JournalLineRequest {
  accountId: number;
  costCenterId?: number | null;
  description?: string | null;
  debit: number;
  credit: number;
  partyType?: PartyType | null;
  partyId?: number | null;
}

export interface CreateJournalEntryRequest {
  entryDate: string;
  reference?: string | null;
  narration?: string | null;
  sourceType?: JournalSourceType;
  sourceId?: number | null;
  currencyCode?: string | null;
  exchangeRate?: number | null;
  lines: JournalLineRequest[];
  postImmediately?: boolean;
}

export interface JournalQuery {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  status?: JournalStatus;
  sourceType?: JournalSourceType;
}

