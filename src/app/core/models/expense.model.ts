export type PaidBy = 'COMPANY' | 'EMPLOYEE';

export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'REIMBURSED'
  | 'VOID';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface ExpenseApproval {
  id?: number;
  step: number;
  approverId?: number;
  approverName: string;
  decision: ApprovalDecision;
  comment?: string;
  decidedAt?: string;
}

export interface Attachment {
  id: number;
  companyId?: number;
  entityType: string;
  entityId: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey?: string;
  uploadedBy?: number;
  uploadedByName?: string;
  uploadedAt?: string;
}

export interface ExpenseCategory {
  id: number;
  companyId?: number;
  name: string;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  defaultTaxRateId?: number | null;
  limitPerClaim?: number | null;
  receiptRequired: boolean;
  isActive: boolean;
}

export interface ExpenseCategoryRequest {
  name: string;
  accountId: number;
  defaultTaxRateId?: number | null;
  limitPerClaim?: number | null;
  receiptRequired?: boolean;
  isActive?: boolean;
}

export interface ExpenseLine {
  id?: number;
  lineNo?: number;
  categoryId: number;
  categoryName?: string;
  accountId?: number;
  accountCode?: string;
  accountName?: string;
  description: string;
  amount: number;
  taxRateId?: number | null;
  taxAmount?: number;
  costCenterId?: number | null;
  costCenterName?: string;
  customerId?: number | null;
  customerName?: string;
  isBillable?: boolean;
}

export interface ExpenseLineRequest {
  lineNo?: number;
  categoryId: number;
  accountId?: number | null;
  description: string;
  amount: number;
  taxRateId?: number | null;
  costCenterId?: number | null;
  customerId?: number | null;
  isBillable?: boolean;
}

export interface Expense {
  id: number;
  companyId?: number;
  expenseNo: string;
  expenseDate: string;
  paidBy: PaidBy;
  employeeUserId?: number | null;
  employeeName?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  payeeName?: string | null;
  bankAccountId?: number | null;
  bankAccountName?: string | null;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: ExpenseStatus;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  journalEntryId?: number | null;
  journalEntryNo?: string | null;
  reimbursementEntryId?: number | null;
  reimbursementEntryNo?: string | null;
  lines: ExpenseLine[];
  attachments?: Attachment[];
  approvals?: ExpenseApproval[];
}

export interface CreateExpenseRequest {
  expenseDate: string;
  paidBy: PaidBy;
  employeeUserId?: number | null;
  vendorId?: number | null;
  payeeName?: string | null;
  bankAccountId?: number | null;
  currencyCode?: string;
  exchangeRate?: number;
  lines: ExpenseLineRequest[];
}

export interface UpdateExpenseRequest {
  expenseDate?: string;
  paidBy?: PaidBy;
  employeeUserId?: number | null;
  vendorId?: number | null;
  payeeName?: string | null;
  bankAccountId?: number | null;
  currencyCode?: string;
  exchangeRate?: number;
  lines?: ExpenseLineRequest[];
}

export interface ApproveExpenseRequest {
  comment?: string;
}

export interface RejectExpenseRequest {
  reason: string;
}

export interface BatchReimburseRequest {
  expenseIds: number[];
  bankAccountId: number;
  paymentDate?: string;
}

export interface BatchReimburseResponse {
  batchId?: string;
  journalEntryId?: number;
  journalEntryNo?: string;
  processedCount: number;
  totalAmount: number;
  paymentDate: string;
}

export interface ExpenseQuery {
  tab?: 'all' | 'mine' | 'approvals' | 'reimburse';
  status?: ExpenseStatus | '';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface ExpenseSummaryCards {
  postedSpend: number;
  awaitingApprovalAmount: number;
  awaitingApprovalCount: number;
  owedToEmployees: number;
  owedToEmployeesCount: number;
  topCategoryName: string;
  topCategoryAmount: number;
}

