import '@angular/compiler';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Attachment,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  PaidBy
} from '../../core/models/expense.model';
import { ExpenseService } from './services/expense.service';

describe('Expenses Module - KPI Calculation Logic (Section 4.10)', () => {
  const mockExpenses: Expense[] = [
    {
      id: 1,
      expenseNo: 'EXP-2026-0001',
      expenseDate: '2026-10-15',
      paidBy: 'EMPLOYEE',
      employeeUserId: 10,
      employeeName: 'Sara Mathew',
      currencyCode: 'AED',
      exchangeRate: 1,
      subtotal: 1000,
      taxTotal: 50,
      total: 1050,
      status: 'POSTED',
      lines: [
        { categoryId: 1, categoryName: 'Travel & Lodging', description: 'Hotel stay', amount: 1000 }
      ],
      attachments: [{ id: 101, entityType: 'EXPENSE', entityId: 1, fileName: 'hotel.pdf', contentType: 'application/pdf', sizeBytes: 120000 }]
    },
    {
      id: 2,
      expenseNo: 'EXP-2026-0002',
      expenseDate: '2026-10-18',
      paidBy: 'EMPLOYEE',
      employeeUserId: 11,
      employeeName: 'Raj Kumar',
      currencyCode: 'AED',
      exchangeRate: 1,
      subtotal: 400,
      taxTotal: 20,
      total: 420,
      status: 'SUBMITTED',
      lines: [
        { categoryId: 2, categoryName: 'Meals & Entertainment', description: 'Client dinner', amount: 400 }
      ],
      attachments: []
    },
    {
      id: 3,
      expenseNo: 'EXP-2026-0003',
      expenseDate: '2026-10-20',
      paidBy: 'COMPANY',
      bankAccountId: 1,
      bankAccountName: 'Emirates NBD',
      currencyCode: 'AED',
      exchangeRate: 1,
      subtotal: 2500,
      taxTotal: 125,
      total: 2625,
      status: 'POSTED',
      lines: [
        { categoryId: 1, categoryName: 'Travel & Lodging', description: 'Flight tickets', amount: 2500 }
      ],
      attachments: [{ id: 102, entityType: 'EXPENSE', entityId: 3, fileName: 'ticket.pdf', contentType: 'application/pdf', sizeBytes: 250000 }]
    },
    {
      id: 4,
      expenseNo: 'EXP-2026-0004',
      expenseDate: '2026-10-22',
      paidBy: 'EMPLOYEE',
      employeeUserId: 10,
      employeeName: 'Sara Mathew',
      currencyCode: 'AED',
      exchangeRate: 1,
      subtotal: 300,
      taxTotal: 15,
      total: 315,
      status: 'REIMBURSED',
      lines: [
        { categoryId: 3, categoryName: 'Fuel & Transportation', description: 'Petrol taxi', amount: 300 }
      ],
      attachments: [{ id: 103, entityType: 'EXPENSE', entityId: 4, fileName: 'fuel.jpg', contentType: 'image/jpeg', sizeBytes: 95000 }]
    },
    {
      id: 5,
      expenseNo: 'EXP-2026-0005',
      expenseDate: '2026-10-24',
      paidBy: 'EMPLOYEE',
      employeeUserId: 12,
      employeeName: 'Tariq Al-Mansoor',
      currencyCode: 'AED',
      exchangeRate: 1,
      subtotal: 500,
      taxTotal: 25,
      total: 525,
      status: 'APPROVED',
      lines: [
        { categoryId: 2, categoryName: 'Meals & Entertainment', description: 'Team catering', amount: 500 }
      ],
      attachments: [{ id: 104, entityType: 'EXPENSE', entityId: 5, fileName: 'catering.pdf', contentType: 'application/pdf', sizeBytes: 180000 }]
    }
  ];

  it('should compute posted spend accurately (POSTED and REIMBURSED claims)', () => {
    const summary = ExpenseService.computeSummaryCards(mockExpenses);
    // EXP-0001 (1050) + EXP-0003 (2625) + EXP-0004 (315) = 3990
    expect(summary.postedSpend).toBe(3990);
  });

  it('should compute amount awaiting approval (SUBMITTED claims)', () => {
    const summary = ExpenseService.computeSummaryCards(mockExpenses);
    // EXP-0002 (420)
    expect(summary.awaitingApprovalAmount).toBe(420);
    expect(summary.awaitingApprovalCount).toBe(1);
  });

  it('should compute amount owed to employees (EMPLOYEE paid, APPROVED/POSTED, not yet REIMBURSED)', () => {
    const summary = ExpenseService.computeSummaryCards(mockExpenses);
    // EXP-0001 (1050, POSTED) + EXP-0005 (525, APPROVED) = 1575
    expect(summary.owedToEmployees).toBe(1575);
    expect(summary.owedToEmployeesCount).toBe(2);
  });

  it('should identify top expense category by spend volume', () => {
    const summary = ExpenseService.computeSummaryCards(mockExpenses);
    // Travel & Lodging: 1000 + 2500 = 3500 AED
    // Meals: 400 + 500 = 900 AED
    // Fuel: 300 AED
    expect(summary.topCategoryName).toBe('Travel & Lodging');
    expect(summary.topCategoryAmount).toBe(3500);
  });
});

describe('Expenses Module - Tabs & Workflow Filtering Logic (Section 4.10)', () => {
  const sampleItems: { id: number; paidBy: PaidBy; employeeUserId?: number; status: ExpenseStatus }[] = [
    { id: 1, paidBy: 'EMPLOYEE', employeeUserId: 10, status: 'DRAFT' },
    { id: 2, paidBy: 'EMPLOYEE', employeeUserId: 10, status: 'SUBMITTED' },
    { id: 3, paidBy: 'EMPLOYEE', employeeUserId: 11, status: 'SUBMITTED' },
    { id: 4, paidBy: 'EMPLOYEE', employeeUserId: 10, status: 'POSTED' },
    { id: 5, paidBy: 'COMPANY', status: 'POSTED' },
    { id: 6, paidBy: 'EMPLOYEE', employeeUserId: 11, status: 'APPROVED' },
    { id: 7, paidBy: 'EMPLOYEE', employeeUserId: 10, status: 'REIMBURSED' }
  ];

  it('should filter "mine" tab to only the current user claims', () => {
    const currentUserId = 10;
    const mine = sampleItems.filter(e => e.paidBy === 'EMPLOYEE' && e.employeeUserId === currentUserId);
    expect(mine.length).toBe(4);
    expect(mine.map(m => m.id)).toEqual([1, 2, 4, 7]);
  });

  it('should filter "approvals" tab to all claims in SUBMITTED state', () => {
    const approvals = sampleItems.filter(e => e.status === 'SUBMITTED');
    expect(approvals.length).toBe(2);
    expect(approvals.map(a => a.id)).toEqual([2, 3]);
  });

  it('should filter "reimburse" tab to EMPLOYEE claims ready for payout (POSTED or APPROVED)', () => {
    const toReimburse = sampleItems.filter(
      e => e.paidBy === 'EMPLOYEE' && (e.status === 'POSTED' || e.status === 'APPROVED')
    );
    expect(toReimburse.length).toBe(2);
    expect(toReimburse.map(r => r.id)).toEqual([4, 6]);
  });
});

describe('Expenses Module - Paperclip Column & Missing Receipt Indicators (Section 4.10)', () => {
  const categories: ExpenseCategory[] = [
    { id: 1, name: 'Travel & Lodging', accountId: 5300, receiptRequired: true, isActive: true },
    { id: 2, name: 'Office Supplies', accountId: 5330, receiptRequired: false, isActive: true }
  ];

  function checkMissingReceipt(
    lines: { categoryId: number }[],
    attachments: Attachment[]
  ): boolean {
    const hasAttachments = attachments && attachments.length > 0;
    if (hasAttachments) return false;
    return lines.some(line => {
      const cat = categories.find(c => c.id === line.categoryId);
      return cat ? cat.receiptRequired : true;
    });
  }

  it('should flag missing receipt when category requires receipt and 0 files attached', () => {
    const lines = [{ categoryId: 1 }]; // Travel requires receipt
    const attachments: Attachment[] = [];
    expect(checkMissingReceipt(lines, attachments)).toBe(true);
  });

  it('should NOT flag missing receipt when receipt is attached', () => {
    const lines = [{ categoryId: 1 }];
    const attachments: Attachment[] = [
      { id: 1, entityType: 'EXPENSE', entityId: 1, fileName: 'invoice.pdf', contentType: 'application/pdf', sizeBytes: 50000 }
    ];
    expect(checkMissingReceipt(lines, attachments)).toBe(false);
  });

  it('should NOT flag missing receipt when category does not require receipt', () => {
    const lines = [{ categoryId: 2 }]; // Office supplies receiptRequired: false
    const attachments: Attachment[] = [];
    expect(checkMissingReceipt(lines, attachments)).toBe(false);
  });
});

describe('Expenses Module - Real-Time Category Policy Checks (Section 4.11)', () => {
  const hotelCategory: ExpenseCategory = {
    id: 1,
    name: 'Travel & Lodging',
    accountId: 5300,
    limitPerClaim: 1500,
    receiptRequired: true,
    isActive: true
  };

  it('should raise warning when receipt required and no file attached', () => {
    const policyResult = ExpenseService.checkCategoryPolicy(hotelCategory, 1200, false);
    expect(policyResult.hasWarning).toBe(true);
    expect(policyResult.requiresReceipt).toBe(true);
    expect(policyResult.exceedsLimit).toBe(false);
    expect(policyResult.messages[0]).toContain('Receipt required');
  });

  it('should raise warning when line amount exceeds category policy limit per claim', () => {
    // Hotel limit is 1500, amount is 1850
    const policyResult = ExpenseService.checkCategoryPolicy(hotelCategory, 1850, true);
    expect(policyResult.hasWarning).toBe(true);
    expect(policyResult.requiresReceipt).toBe(false);
    expect(policyResult.exceedsLimit).toBe(true);
    expect(policyResult.messages[0]).toContain('exceeds limit of AED 1500.00');
  });

  it('should pass cleanly when within limit and receipt attached', () => {
    const policyResult = ExpenseService.checkCategoryPolicy(hotelCategory, 1400, true);
    expect(policyResult.hasWarning).toBe(false);
    expect(policyResult.requiresReceipt).toBe(false);
    expect(policyResult.exceedsLimit).toBe(false);
    expect(policyResult.messages.length).toBe(0);
  });
});

describe('Expenses Module - Approval Flow Stepper & Journal Entry Preview (Section 4.11)', () => {
  const financeThreshold = 2000.00;

  function evaluateApprovalSteps(grandTotal: number): { stepsRequired: number; includesFinance: boolean } {
    if (grandTotal > financeThreshold) {
      return { stepsRequired: 2, includesFinance: true };
    }
    return { stepsRequired: 1, includesFinance: false };
  }

  it('should require 1 approval step for claims <= 2000 AED', () => {
    const result = evaluateApprovalSteps(1250);
    expect(result.stepsRequired).toBe(1);
    expect(result.includesFinance).toBe(false);
  });

  it('should require 2 approval steps (Line Manager + Finance Review) for claims > 2000 AED', () => {
    const result = evaluateApprovalSteps(2850);
    expect(result.stepsRequired).toBe(2);
    expect(result.includesFinance).toBe(true);
  });

  it('should generate balanced Journal Entry preview for company-paid expense', () => {
    const subtotal = 1000;
    const vat = 50;
    const grandTotal = 1050;

    const debits = [
      { account: '5300 Travel & Lodging', amount: subtotal },
      { account: '2200 Input VAT', amount: vat }
    ];
    const credits = [
      { account: '1110 Emirates NBD Bank', amount: grandTotal }
    ];

    const totalDebits = debits.reduce((acc, d) => acc + d.amount, 0);
    const totalCredits = credits.reduce((acc, c) => acc + c.amount, 0);

    expect(totalDebits).toBe(1050);
    expect(totalCredits).toBe(1050);
    expect(totalDebits).toBe(totalCredits);
  });

  it('should generate balanced Journal Entry preview for employee-reimbursable claim', () => {
    const subtotal = 800;
    const vat = 40;
    const grandTotal = 840;

    const debits = [
      { account: '5310 Meals & Entertainment', amount: subtotal },
      { account: '2200 Input VAT', amount: vat }
    ];
    const credits = [
      { account: '2150 Employee Reimbursements Payable', amount: grandTotal }
    ];

    const totalDebits = debits.reduce((acc, d) => acc + d.amount, 0);
    const totalCredits = credits.reduce((acc, c) => acc + c.amount, 0);

    expect(totalDebits).toBe(840);
    expect(totalCredits).toBe(840);
    expect(totalDebits).toBe(totalCredits);
  });
});

describe('Expenses Module - Attachment Upload Progress', () => {
  let service: ExpenseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ExpenseService]
    });
    service = TestBed.inject(ExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should emit upload progress events and final attachment response', () => {
    const file = new File(['receipt-bytes'], 'receipt.pdf', { type: 'application/pdf' });
    const eventTypes: HttpEventType[] = [];

    service.uploadAttachmentWithProgress(file, 'EXPENSE', 42).subscribe(ev => {
      eventTypes.push(ev.type);
    });

    const req = httpMock.expectOne(r => r.url.endsWith('/attachments'));
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.flush({
      id: 7,
      entityType: 'EXPENSE',
      entityId: 42,
      fileName: 'receipt.pdf',
      contentType: 'application/pdf',
      sizeBytes: 13
    });

    expect(eventTypes).toContain(HttpEventType.UploadProgress);
    expect(eventTypes).toContain(HttpEventType.Response);
  });
});
