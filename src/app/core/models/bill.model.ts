export type BillDocType = 'BILL' | 'DEBIT_NOTE';
export type BillStatus = 'DRAFT' | 'APPROVED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID';

export interface BillLine {
  id?: number;
  lineNo?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId?: number;
  taxAmount?: number;
  lineTotal?: number;
  accountId: number;
  warehouseId?: number;
  costCenterId?: number;
}

export interface Bill {
  id: number;
  companyId: number;
  billNo: string;
  vendorInvoiceNo?: string;
  docType: BillDocType;
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  billDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: BillStatus;
  notes?: string;
  journalEntryId?: number;
  lines: BillLine[];
}

export interface BillLineRequest {
  lineNo?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId?: number;
  accountId: number;
  warehouseId?: number;
  costCenterId?: number;
}

export interface BillRequest {
  docType?: BillDocType;
  vendorInvoiceNo?: string;
  vendorId: number;
  billDate: string;
  dueDate?: string;
  currencyCode?: string;
  exchangeRate?: number;
  notes?: string;
  lines: BillLineRequest[];
}

export interface BillQuery {
  page?: number;
  size?: number;
  vendorId?: number;
  status?: BillStatus;
  from?: string;
  to?: string;
}

export interface OpenBill {
  id: number;
  billNo: string;
  vendorInvoiceNo?: string;
  billDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

