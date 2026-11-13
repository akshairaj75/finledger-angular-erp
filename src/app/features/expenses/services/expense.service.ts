import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApproveExpenseRequest,
  Attachment,
  BatchReimburseRequest,
  BatchReimburseResponse,
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  ExpenseQuery,
  ExpenseSummaryCards,
  RejectExpenseRequest,
  UpdateExpenseRequest
} from '../../../core/models/expense.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/expenses`;
  private categoriesBase = `${environment.apiBaseUrl}/expense-categories`;
  private attachmentsBase = `${environment.apiBaseUrl}/attachments`;

  getExpenses(query: ExpenseQuery = {}): Observable<Page<Expense>> {
    let params = new HttpParams();
    if (query.tab) params = params.set('tab', query.tab);
    if (query.status) params = params.set('status', query.status);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.page !== undefined) params = params.set('page', query.page.toString());
    if (query.size !== undefined) params = params.set('size', query.size.toString());

    return this.http.get<Page<Expense>>(this.base, { params });
  }

  getExpenseById(id: number): Observable<Expense> {
    return this.http.get<Expense>(`${this.base}/${id}`);
  }

  createExpense(request: CreateExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.base, request);
  }

  updateExpense(id: number, request: UpdateExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/${id}`, request);
  }

  submitExpense(id: number): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/${id}/submit`, {});
  }

  approveExpense(id: number, comment?: string): Observable<Expense> {
    const payload: ApproveExpenseRequest = { comment: comment || 'Approved' };
    return this.http.post<Expense>(`${this.base}/${id}/approve`, payload);
  }

  rejectExpense(id: number, reason: string): Observable<Expense> {
    const payload: RejectExpenseRequest = { reason };
    return this.http.post<Expense>(`${this.base}/${id}/reject`, payload);
  }

  reimburseExpenses(request: BatchReimburseRequest): Observable<BatchReimburseResponse> {
    return this.http.post<BatchReimburseResponse>(`${this.base}/reimburse`, request);
  }

  // Categories
  getAllActiveCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.categoriesBase}/all`);
  }

  // Attachments
  uploadAttachment(file: File, entityType: string, entityId: number): Observable<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId.toString());
    return this.http.post<Attachment>(this.attachmentsBase, formData);
  }

  uploadAttachmentWithProgress(file: File, entityType: string, entityId: number): Observable<HttpEvent<Attachment>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId.toString());
    const req = new HttpRequest('POST', this.attachmentsBase, formData, {
      reportProgress: true
    });
    return this.http.request<Attachment>(req);
  }

  getAttachments(entityType: string, entityId: number): Observable<Attachment[]> {
    const params = new HttpParams()
      .set('entityType', entityType)
      .set('entityId', entityId.toString());
    return this.http.get<Attachment[]>(this.attachmentsBase, { params });
  }

  deleteAttachment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.attachmentsBase}/${id}`);
  }

  getAttachmentDownloadUrl(id: number): string {
    return `${this.attachmentsBase}/${id}`;
  }

  // Helper method to compute summary metrics across expenses
  static computeSummaryCards(expenses: Expense[]): ExpenseSummaryCards {
    let postedSpend = 0;
    let awaitingApprovalAmount = 0;
    let awaitingApprovalCount = 0;
    let owedToEmployees = 0;
    let owedToEmployeesCount = 0;
    const categoryTotals = new Map<string, number>();

    for (const exp of expenses) {
      const total = Number(exp.total) || 0;

      // Posted spend: POSTED or REIMBURSED
      if (exp.status === 'POSTED' || exp.status === 'REIMBURSED') {
        postedSpend += total;
      }

      // Awaiting approval: SUBMITTED
      if (exp.status === 'SUBMITTED') {
        awaitingApprovalAmount += total;
        awaitingApprovalCount++;
      }

      // Owed to employees: Paid by EMPLOYEE and approved/posted, but not yet reimbursed
      if (exp.paidBy === 'EMPLOYEE' && (exp.status === 'APPROVED' || exp.status === 'POSTED')) {
        owedToEmployees += total;
        owedToEmployeesCount++;
      }

      // Category breakdown
      if (exp.lines) {
        for (const line of exp.lines) {
          const catName = line.categoryName || 'General';
          const lineAmt = Number(line.amount) || 0;
          categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + lineAmt);
        }
      }
    }

    let topCategoryName = 'None';
    let topCategoryAmount = 0;
    for (const [name, amount] of categoryTotals.entries()) {
      if (amount > topCategoryAmount) {
        topCategoryAmount = amount;
        topCategoryName = name;
      }
    }

    return {
      postedSpend,
      awaitingApprovalAmount,
      awaitingApprovalCount,
      owedToEmployees,
      owedToEmployeesCount,
      topCategoryName,
      topCategoryAmount
    };
  }

  computeSummaryCards(expenses: Expense[]): ExpenseSummaryCards {
    return ExpenseService.computeSummaryCards(expenses);
  }

  // Policy checker helper
  static checkCategoryPolicy(
    category: ExpenseCategory | undefined,
    lineAmount: number,
    hasAttachment: boolean
  ): { hasWarning: boolean; requiresReceipt: boolean; exceedsLimit: boolean; messages: string[] } {
    const messages: string[] = [];
    let requiresReceipt = false;
    let exceedsLimit = false;

    if (!category) {
      return { hasWarning: false, requiresReceipt, exceedsLimit, messages };
    }

    if (category.receiptRequired && !hasAttachment) {
      requiresReceipt = true;
      messages.push(`Receipt required for "${category.name}".`);
    }

    if (category.limitPerClaim && category.limitPerClaim > 0 && lineAmount > category.limitPerClaim) {
      exceedsLimit = true;
      messages.push(
        `Amount AED ${lineAmount.toFixed(2)} exceeds limit of AED ${category.limitPerClaim.toFixed(2)} for "${category.name}".`
      );
    }

    return {
      hasWarning: messages.length > 0,
      requiresReceipt,
      exceedsLimit,
      messages
    };
  }

  checkCategoryPolicy(
    category: ExpenseCategory | undefined,
    lineAmount: number,
    hasAttachment: boolean
  ): { hasWarning: boolean; requiresReceipt: boolean; exceedsLimit: boolean; messages: string[] } {
    return ExpenseService.checkCategoryPolicy(category, lineAmount, hasAttachment);
  }
}
