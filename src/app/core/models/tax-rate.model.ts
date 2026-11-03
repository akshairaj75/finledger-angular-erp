export type TaxType = 'STANDARD' | 'ZERO' | 'EXEMPT' | 'OUT_OF_SCOPE';

export interface TaxRate {
  id: number;
  companyId: number;
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  salesAccountId?: number;
  purchaseAccountId?: number;
  isActive: boolean;
}
