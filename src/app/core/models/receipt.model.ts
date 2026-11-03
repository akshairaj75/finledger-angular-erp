export type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';
export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface ReceiptAllocation {
  id?: number;
  invoiceId: number;
  invoiceNo?: string;
  amount: number;
}

export interface Receipt {
  id: number;
  companyId: number;
  receiptNo: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  receiptDate: string;
  bankAccountId: number;
  bankAccountName: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  currencyCode: string;
  amount: number;
  unappliedAmount: number;
  status: ReceiptStatus;
  journalEntryId?: number;
  allocations: ReceiptAllocation[];
}

export interface ReceiptAllocationRequest {
  invoiceId: number;
  amount: number;
}

export interface ReceiptRequest {
  customerId: number;
  receiptDate: string;
  bankAccountId: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  currencyCode?: string;
  amount: number;
  allocations: ReceiptAllocationRequest[];
}

export interface ReceiptQuery {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  status?: ReceiptStatus;
  customerId?: number;
}
