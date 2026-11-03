export type CustomerType = 'BUSINESS' | 'INDIVIDUAL';

export interface Customer {
  id: number;
  companyId: number;
  code: string;
  name: string;
  trn?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currencyCode: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  arAccountId: number;
  accountManagerId?: number;
  sourceLeadId?: number;
  isActive: boolean;
}

export interface CustomerRequest {
  code: string;
  name: string;
  trn?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currencyCode: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  arAccountId: number;
  accountManagerId?: number;
  sourceLeadId?: number;
  isActive?: boolean;
}

export interface CustomerQuery {
  page?: number;
  size?: number;
  search?: string;
  customerType?: CustomerType;
  isActive?: boolean;
}
