export interface GeneralLedgerLine {
  date: string;
  entryNo: string;
  reference?: string;
  description?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerReport {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: GeneralLedgerLine[];
}

