export interface Vendor {
  id: number;
  companyId: number;
  code: string;
  name: string;
  trn?: string;
  email?: string;
  phone?: string;
  address?: string;
  currencyCode: string;
  paymentTermsDays: number;
  bankIban?: string;
  apAccountId: number;
  isActive: boolean;
}

export interface VendorRequest {
  code: string;
  name: string;
  trn?: string;
  email?: string;
  phone?: string;
  address?: string;
  currencyCode: string;
  paymentTermsDays?: number;
  bankIban?: string;
  apAccountId: number;
  isActive?: boolean;
}

export interface VendorQuery {
  page?: number;
  size?: number;
  search?: string;
  isActive?: boolean;
}

