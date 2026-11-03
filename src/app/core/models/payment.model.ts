import { PaymentMethod } from './receipt.model';

export type PaymentStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface PaymentAllocation {
  id?: number;
  billId: number;
  billNo?: string;
  amount: number;
}

export interface Payment {
  id: number;
  companyId: number;
  paymentNo: string;
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  paymentDate: string;
  bankAccountId: number;
  bankAccountName: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  currencyCode: string;
  amount: number;
  unappliedAmount: number;
  status: PaymentStatus;
  journalEntryId?: number;
  allocations: PaymentAllocation[];
}

export interface PaymentAllocationRequest {
  billId: number;
  amount: number;
}

export interface PaymentRequest {
  vendorId: number;
  paymentDate: string;
  bankAccountId: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  currencyCode?: string;
  amount: number;
  allocations: PaymentAllocationRequest[];
}

export interface PaymentQuery {
  page?: number;
  size?: number;
  vendorId?: number;
}

