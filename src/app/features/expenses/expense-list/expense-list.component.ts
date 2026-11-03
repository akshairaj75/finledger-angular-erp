import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BankAccount } from '../../../core/models/bank-account.model';
import {
  Attachment,
  BatchReimburseRequest,
  Expense,
  ExpenseCategory,
  ExpenseQuery,
  ExpenseStatus,
  ExpenseSummaryCards,
  PaidBy
} from '../../../core/models/expense.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import { BankAccountService } from '../../sales/services/bank-account.service';
import { ExpenseService } from '../services/expense.service';

export type ExpenseTab = 'all' | 'mine' | 'approvals' | 'reimburse';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.css']
})
export class ExpenseListComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private bankAccountService = inject(BankAccountService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  expensesPage: Page<Expense> = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  };

  allLoadedExpenses: Expense[] = [];
  categories: ExpenseCategory[] = [];
  bankAccounts: BankAccount[] = [];

  summary: ExpenseSummaryCards = {
    postedSpend: 0,
    awaitingApprovalAmount: 0,
    awaitingApprovalCount: 0,
    owedToEmployees: 0,
    owedToEmployeesCount: 0,
    topCategoryName: 'None',
    topCategoryAmount: 0
  };

  loading = false;
  activeTab: ExpenseTab = 'all';
  currentPage = 0;
  pageSize = 15;

  // Filters
  filterStatus: ExpenseStatus | '' = '';
  searchQuery = '';
  filterFrom = '';
  filterTo = '';

  readonly tabs: { key: ExpenseTab; label: string; icon: string }[] = [
    { key: 'all', label: 'All Expenses', icon: '📋' },
    { key: 'mine', label: 'My Expenses', icon: '👤' },
    { key: 'approvals', label: 'Awaiting My Approval', icon: '⏳' },
    { key: 'reimburse', label: 'To Reimburse', icon: '💳' }
  ];

  readonly statuses: ExpenseStatus[] = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'POSTED',
    'REIMBURSED',
    'REJECTED',
    'VOID'
  ];

  // Selection
  selectedIds = new Set<number>();

  // Modals
  selectedExpense: Expense | null = null;
  showDetailModal = false;

  // Single / Bulk Reject Modal
  showRejectModal = false;
  rejectTargetIds: number[] = [];
  rejectReason = '';
  rejecting = false;

  // Reimburse Modal
  showReimburseModal = false;
  reimburseTargetIds: number[] = [];
  selectedBankAccountId: number | null = null;
  reimbursementDate: string = new Date().toISOString().substring(0, 10);
  reimbursing = false;

  // Approve in progress
  approvingIds = new Set<number>();

  ngOnInit(): void {
    this.loadCategories();
    this.loadBankAccounts();

    this.route.queryParams.subscribe(params => {
      this.activeTab = (params['tab'] as ExpenseTab) || 'all';
      this.filterStatus = (params['status'] as ExpenseStatus) || '';
      this.filterFrom = params['from'] || '';
      this.filterTo = params['to'] || '';
      this.currentPage = params['page'] ? Number(params['page']) : 0;
      this.selectedIds.clear();
      this.loadExpenses();
    });
  }

  loadCategories(): void {
    this.expenseService.getAllActiveCategories().subscribe({
      next: cats => (this.categories = cats),
      error: () => (this.categories = [])
    });
  }

  loadBankAccounts(): void {
    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        this.bankAccounts = accounts;
        if (accounts.length > 0 && !this.selectedBankAccountId) {
          this.selectedBankAccountId = accounts[0].id;
        }
      },
      error: () => (this.bankAccounts = [])
    });
  }

  switchTab(tab: ExpenseTab): void {
    this.activeTab = tab;
    this.currentPage = 0;
    this.selectedIds.clear();
    this.updateUrlParams();
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.updateUrlParams();
  }

  private updateUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeTab === 'all' ? null : this.activeTab,
        status: this.filterStatus || null,
        from: this.filterFrom || null,
        to: this.filterTo || null,
        page: this.currentPage > 0 ? this.currentPage : null
      },
      queryParamsHandling: 'merge'
    });
  }

  loadExpenses(): void {
    this.loading = true;
    const query: ExpenseQuery = {
      tab: this.activeTab,
      status: this.filterStatus || undefined,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      page: this.currentPage,
      size: this.pageSize
    };

    this.expenseService.getExpenses(query).subscribe({
      next: page => {
        let items = page.content || [];

        // Apply local text search if present
        if (this.searchQuery.trim()) {
          const q = this.searchQuery.toLowerCase();
          items = items.filter(
            exp =>
              (exp.expenseNo && exp.expenseNo.toLowerCase().includes(q)) ||
              (exp.employeeName && exp.employeeName.toLowerCase().includes(q)) ||
              (exp.payeeName && exp.payeeName.toLowerCase().includes(q)) ||
              (exp.lines && exp.lines.some(l => l.description.toLowerCase().includes(q)))
          );
        }

        // Apply tab logic client-side as well for robust testing/mocking
        if (this.activeTab === 'approvals') {
          items = items.filter(exp => exp.status === 'SUBMITTED');
        } else if (this.activeTab === 'reimburse') {
          items = items.filter(
            exp => exp.paidBy === 'EMPLOYEE' && (exp.status === 'POSTED' || exp.status === 'APPROVED')
          );
        }

        this.expensesPage = {
          ...page,
          content: items,
          totalElements: items.length
        };

        // Compute summary KPIs
        this.updateKpiSummary();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private updateKpiSummary(): void {
    // If we have loaded expenses, recalculate KPIs
    const items = this.expensesPage.content;
    this.summary = this.expenseService.computeSummaryCards(items);
  }

  // Multi-selection
  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.expensesPage.content.forEach(e => this.selectedIds.add(e.id));
    } else {
      this.selectedIds.clear();
    }
  }

  isAllSelected(): boolean {
    return (
      this.expensesPage.content.length > 0 &&
      this.expensesPage.content.every(e => this.selectedIds.has(e.id))
    );
  }

  getSelectedExpenses(): Expense[] {
    return this.expensesPage.content.filter(e => this.selectedIds.has(e.id));
  }

  // Missing Receipt Indicator logic
  isMissingReceipt(expense: Expense): boolean {
    const hasAttachments = !!(expense.attachments && expense.attachments.length > 0);
    if (hasAttachments) return false;

    // Check if any line has category requiring receipt
    if (!expense.lines || expense.lines.length === 0) return false;

    return expense.lines.some(line => {
      const cat = this.categories.find(c => c.id === line.categoryId);
      return cat ? cat.receiptRequired : true; // FinLedger v2.0 defaults receiptRequired=1
    });
  }

  getAttachmentCount(expense: Expense): number {
    return expense.attachments?.length || 0;
  }

  // Inline Actions
  approveSingle(expense: Expense): void {
    if (this.approvingIds.has(expense.id)) return;
    this.approvingIds.add(expense.id);

    this.expenseService.approveExpense(expense.id, 'Approved inline').subscribe({
      next: updated => {
        this.approvingIds.delete(expense.id);
        this.notificationService.success(`Expense ${expense.expenseNo} approved successfully.`);
        this.replaceExpenseInList(updated);
      },
      error: err => {
        this.approvingIds.delete(expense.id);
        const msg = err?.error?.message || `Failed to approve expense ${expense.expenseNo}`;
        this.notificationService.error(msg);
      }
    });
  }

  promptReject(expense: Expense): void {
    this.rejectTargetIds = [expense.id];
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  // Bulk Actions
  bulkApprove(): void {
    const eligible = this.getSelectedExpenses().filter(e => e.status === 'SUBMITTED');
    if (eligible.length === 0) {
      this.notificationService.warning('No SUBMITTED expenses selected for approval.');
      return;
    }

    let completed = 0;
    eligible.forEach(e => this.approvingIds.add(e.id));

    eligible.forEach(exp => {
      this.expenseService.approveExpense(exp.id, 'Bulk approved').subscribe({
        next: updated => {
          this.approvingIds.delete(exp.id);
          this.replaceExpenseInList(updated);
          completed++;
          if (completed === eligible.length) {
            this.notificationService.success(`${completed} expense(s) approved.`);
            this.selectedIds.clear();
            this.updateKpiSummary();
          }
        },
        error: err => {
          this.approvingIds.delete(exp.id);
          const msg = err?.error?.message || `Failed to approve ${exp.expenseNo}`;
          this.notificationService.error(msg);
        }
      });
    });
  }

  promptBulkReject(): void {
    const eligible = this.getSelectedExpenses().filter(e => e.status === 'SUBMITTED');
    if (eligible.length === 0) {
      this.notificationService.warning('No SUBMITTED expenses selected for rejection.');
      return;
    }
    this.rejectTargetIds = eligible.map(e => e.id);
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectReason.trim()) {
      this.notificationService.warning('Rejection reason is required.');
      return;
    }
    this.rejecting = true;
    let completed = 0;

    this.rejectTargetIds.forEach(id => {
      this.expenseService.rejectExpense(id, this.rejectReason.trim()).subscribe({
        next: updated => {
          this.replaceExpenseInList(updated);
          completed++;
          if (completed === this.rejectTargetIds.length) {
            this.rejecting = false;
            this.showRejectModal = false;
            this.notificationService.success(`${completed} expense(s) rejected.`);
            this.selectedIds.clear();
            this.updateKpiSummary();
          }
        },
        error: err => {
          this.rejecting = false;
          const msg = err?.error?.message || `Failed to reject expense #${id}`;
          this.notificationService.error(msg);
        }
      });
    });
  }

  // Reimbursement Actions
  promptReimburse(): void {
    const eligible = this.getSelectedExpenses().filter(
      e => e.paidBy === 'EMPLOYEE' && (e.status === 'POSTED' || e.status === 'APPROVED')
    );
    if (eligible.length === 0) {
      this.notificationService.warning('No approved employee claims selected for reimbursement.');
      return;
    }
    this.reimburseTargetIds = eligible.map(e => e.id);
    this.showReimburseModal = true;
  }

  confirmReimburse(): void {
    if (!this.selectedBankAccountId) {
      this.notificationService.warning('Please select a payment bank/cash account.');
      return;
    }
    this.reimbursing = true;
    const request: BatchReimburseRequest = {
      expenseIds: this.reimburseTargetIds,
      bankAccountId: this.selectedBankAccountId,
      paymentDate: this.reimbursementDate
    };

    this.expenseService.reimburseExpenses(request).subscribe({
      next: res => {
        this.reimbursing = false;
        this.showReimburseModal = false;
        this.notificationService.success(
          `Reimbursed ${res.processedCount} claims (Total: AED ${res.totalAmount.toFixed(2)}) via entry ${res.journalEntryNo || 'JV'}.`
        );
        this.selectedIds.clear();
        this.loadExpenses();
      },
      error: err => {
        this.reimbursing = false;
        const msg = err?.error?.message || 'Failed to process reimbursement.';
        this.notificationService.error(msg);
      }
    });
  }

  // Details Modal
  viewDetails(expense: Expense): void {
    this.selectedExpense = expense;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedExpense = null;
  }

  private replaceExpenseInList(updated: Expense): void {
    const idx = this.expensesPage.content.findIndex(e => e.id === updated.id);
    if (idx !== -1) {
      this.expensesPage.content[idx] = updated;
      this.updateKpiSummary();
    }
  }

  getStatusClass(status: ExpenseStatus): string {
    switch (status) {
      case 'DRAFT':
        return 'badge-draft';
      case 'SUBMITTED':
        return 'badge-submitted';
      case 'APPROVED':
        return 'badge-approved';
      case 'POSTED':
        return 'badge-posted';
      case 'REIMBURSED':
        return 'badge-reimbursed';
      case 'REJECTED':
        return 'badge-rejected';
      case 'VOID':
        return 'badge-void';
      default:
        return 'badge-default';
    }
  }
}

