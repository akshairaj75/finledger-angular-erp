export type InvoiceDocType = 'INVOICE' | 'CREDIT_NOTE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceLine {
  id?: number;
  lineNo?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRateId?: number;
  taxAmount?: number;
  lineTotal?: number;
  accountId: number;
  warehouseId?: number;
  unitCost?: number;
  costCenterId?: number;
}

export interface Invoice {
  id: number;
  companyId: number;
  invoiceNo: string;
  docType: InvoiceDocType;
  customerId: number;
  customerName: string;
  customerCode: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
  quotationId?: number;
  salespersonUserId?: number;
  journalEntryId?: number;
  lines: InvoiceLine[];
}

export interface InvoiceLineRequest {
  lineNo?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRateId?: number;
  accountId: number;
  warehouseId?: number;
  costCenterId?: number;
}

export interface InvoiceRequest {
  docType?: InvoiceDocType;
  customerId: number;
  invoiceDate: string;
  dueDate?: string;
  currencyCode?: string;
  exchangeRate?: number;
  notes?: string;
  quotationId?: number;
  salespersonUserId?: number;
  lines: InvoiceLineRequest[];
  send?: boolean;
}

export interface InvoiceQuery {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  status?: InvoiceStatus;
  docType?: InvoiceDocType;
  customerId?: number;
  q?: string;
}

export interface OpenInvoice {
  id: number;
  invoiceNo: string;
  docType: InvoiceDocType;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
}
