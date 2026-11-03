export type AccountKind = 'BANK' | 'CASH' | 'CARD';

export interface BankAccount {
  id: number;
  companyId: number;
  name: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  currencyCode: string;
  glAccountId: number;
  accountKind: AccountKind;
  isActive: boolean;
}
