export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: number;
  companyId: number;
  code: string;
  name: string;
  accountType: AccountType;
  subType?: string;
  parentId?: number;
  isGroup: boolean;
  normalBalance: NormalBalance;
  currencyCode?: string;
  openingBalance: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface AccountNode {
  id: number;
  code: string;
  name: string;
  accountType: AccountType;
  subType?: string;
  parentId?: number;
  isGroup: boolean;
  normalBalance: NormalBalance;
  currencyCode?: string;
  openingBalance: number;
  isSystem: boolean;
  isActive: boolean;
  children?: AccountNode[];
}

