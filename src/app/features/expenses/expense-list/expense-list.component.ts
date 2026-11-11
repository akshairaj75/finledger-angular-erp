import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
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
  imports: [CommonModule, FormsModule, RouterModule, HasPermissionDirective],
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.css']
})
export class ExpenseListComponent implements OnInit {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private bankAccountService = inject(BankAccountService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  expensesPage = signal<Page<Expense>>({
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  });

  categories = signal<ExpenseCategory[]>([]);
  bankAccounts = signal<BankAccount[]>([]);

  summary = signal<ExpenseSummaryCards>({
    postedSpend: 0,
    awaitingApprovalAmount: 0,
    awaitingApprovalCount: 0,
    owedToEmployees: 0,
    owedToEmployeesCount: 0,
    topCategoryName: 'None',
    topCategoryAmount: 0
  });

  loading = signal(false);
  activeTab = signal<ExpenseTab>('all');
  currentPage = signal(0);
  pageSize = 15;

  // Filters
  filterStatus = signal<ExpenseStatus | ''>('');
  searchQuery = signal('');
  filterFrom = signal('');
  filterTo = signal('');

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
  selectedIds = signal<Set<number>>(new Set());

  // Modals
  selectedExpense = signal<Expense | null>(null);
  showDetailModal = signal(false);

  // Single / Bulk Reject Modal
  showRejectModal = signal(false);
  rejectTargetIds = signal<number[]>([]);
  rejectReason = signal('');
  rejecting = signal(false);

  // Reimburse Modal
  showReimburseModal = signal(false);
  reimburseTargetIds = signal<number[]>([]);
  selectedBankAccountId = signal<number | null>(null);
  reimbursementDate = signal<string>(new Date().toISOString().substring(0, 10));
  reimbursing = signal(false);

  // Approve in progress
  approvingIds = signal<Set<number>>(new Set());

  canApproveExpense(exp: Expense): boolean {
    const currentId = this.authService.currentUser()?.id;
    return (
      this.authService.hasPermission('EXPENSE_APPROVE') &&
      exp.status === 'SUBMITTED' &&
      exp.employeeUserId !== currentId
    );
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadBankAccounts();

    this.route.queryParams.subscribe(params => {
      const routeDefaultTab = (this.route.snapshot.data['defaultTab'] as ExpenseTab) || 'all';
      this.activeTab.set((params['tab'] as ExpenseTab) || routeDefaultTab);
      this.filterStatus.set((params['status'] as ExpenseStatus) || '');
      this.filterFrom.set(params['from'] || '');
      this.filterTo.set(params['to'] || '');
      this.currentPage.set(params['page'] ? Number(params['page']) : 0);
      this.selectedIds.set(new Set());
      this.loadExpenses();
    });
  }

  loadCategories(): void {
    this.expenseService.getAllActiveCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => this.categories.set([])
    });
  }

  loadBankAccounts(): void {
    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        this.bankAccounts.set(accounts);
        if (accounts.length > 0 && !this.selectedBankAccountId()) {
          this.selectedBankAccountId.set(accounts[0].id);
        }
      },
      error: () => this.bankAccounts.set([])
    });
  }

  switchTab(tab: ExpenseTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(0);
    this.selectedIds.set(new Set());
    this.updateUrlParams();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.updateUrlParams();
  }

  private updateUrlParams(): void {
    const tab = this.activeTab();
    const page = this.currentPage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: tab === 'all' ? null : tab,
        status: this.filterStatus() || null,
        from: this.filterFrom() || null,
        to: this.filterTo() || null,
        page: page > 0 ? page : null
      },
      queryParamsHandling: 'merge'
    });
  }

  loadExpenses(): void {
    this.loading.set(true);
    const tab = this.activeTab();
    const query: ExpenseQuery = {
      tab,
      status: this.filterStatus() || undefined,
      from: this.filterFrom() || undefined,
      to: this.filterTo() || undefined,
      page: this.currentPage(),
      size: this.pageSize
    };

    this.expenseService.getExpenses(query).subscribe({
      next: page => {
        let items = page.content || [];

        // Apply local text search if present
        const sq = this.searchQuery().trim();
        if (sq) {
          const q = sq.toLowerCase();
          items = items.filter(
            exp =>
              (exp.expenseNo && exp.expenseNo.toLowerCase().includes(q)) ||
              (exp.employeeName && exp.employeeName.toLowerCase().includes(q)) ||
              (exp.payeeName && exp.payeeName.toLowerCase().includes(q)) ||
              (exp.lines && exp.lines.some(l => l.description.toLowerCase().includes(q)))
          );
        }

        // Apply tab logic client-side as well for robust testing/mocking
        if (tab === 'approvals') {
          items = items.filter(exp => exp.status === 'SUBMITTED');
        } else if (tab === 'reimburse') {
          items = items.filter(
            exp => exp.paidBy === 'EMPLOYEE' && (exp.status === 'POSTED' || exp.status === 'APPROVED')
          );
        }

        this.expensesPage.set({
          ...page,
          content: items,
          totalElements: items.length
        });

        // Compute summary KPIs
        this.updateKpiSummary();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private updateKpiSummary(): void {
    const items = this.expensesPage().content;
    this.summary.set(this.expenseService.computeSummaryCards(items));
  }

  // Multi-selection
  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.set(new Set(this.expensesPage().content.map(e => e.id)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  isAllSelected(): boolean {
    const content = this.expensesPage().content;
    const selected = this.selectedIds();
    return content.length > 0 && content.every(e => selected.has(e.id));
  }

  getSelectedExpenses(): Expense[] {
    const selected = this.selectedIds();
    return this.expensesPage().content.filter(e => selected.has(e.id));
  }

  // Missing Receipt Indicator logic
  isMissingReceipt(expense: Expense): boolean {
    const hasAttachments = !!(expense.attachments && expense.attachments.length > 0);
    if (hasAttachments) return false;

    if (!expense.lines || expense.lines.length === 0) return false;
    const cats = this.categories();

    return expense.lines.some(line => {
      const cat = cats.find(c => c.id === line.categoryId);
      return cat ? cat.receiptRequired : true; // FinLedger v2.0 defaults receiptRequired=1
    });
  }

  getAttachmentCount(expense: Expense): number {
    return expense.attachments?.length || 0;
  }

  // Inline Actions
  approveSingle(expense: Expense): void {
    if (this.approvingIds().has(expense.id)) return;
    this.approvingIds.update(s => { const n = new Set(s); n.add(expense.id); return n; });

    this.expenseService.approveExpense(expense.id, 'Approved inline').subscribe({
      next: updated => {
        this.approvingIds.update(s => { const n = new Set(s); n.delete(expense.id); return n; });
        this.notificationService.success(`Expense ${expense.expenseNo} approved successfully.`);
        this.replaceExpenseInList(updated);
      },
      error: err => {
        this.approvingIds.update(s => { const n = new Set(s); n.delete(expense.id); return n; });
        const msg = err?.error?.message || `Failed to approve expense ${expense.expenseNo}`;
        this.notificationService.error(msg);
      }
    });
  }

  promptReject(expense: Expense): void {
    this.rejectTargetIds.set([expense.id]);
    this.rejectReason.set('');
    this.showRejectModal.set(true);
  }

  // Bulk Actions
  bulkApprove(): void {
    const eligible = this.getSelectedExpenses().filter(e => e.status === 'SUBMITTED');
    if (eligible.length === 0) {
      this.notificationService.warning('No SUBMITTED expenses selected for approval.');
      return;
    }

    let completed = 0;
    this.approvingIds.update(s => {
      const n = new Set(s);
      eligible.forEach(e => n.add(e.id));
      return n;
    });

    eligible.forEach(exp => {
      this.expenseService.approveExpense(exp.id, 'Bulk approved').subscribe({
        next: updated => {
          this.approvingIds.update(s => { const n = new Set(s); n.delete(exp.id); return n; });
          this.replaceExpenseInList(updated);
          completed++;
          if (completed === eligible.length) {
            this.notificationService.success(`${completed} expense(s) approved.`);
            this.selectedIds.set(new Set());
            this.updateKpiSummary();
          }
        },
        error: err => {
          this.approvingIds.update(s => { const n = new Set(s); n.delete(exp.id); return n; });
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
    this.rejectTargetIds.set(eligible.map(e => e.id));
    this.rejectReason.set('');
    this.showRejectModal.set(true);
  }

  confirmReject(): void {
    const reason = this.rejectReason().trim();
    if (!reason) {
      this.notificationService.warning('Rejection reason is required.');
      return;
    }
    const targetIds = this.rejectTargetIds();
    this.rejecting.set(true);
    let completed = 0;

    targetIds.forEach(id => {
      this.expenseService.rejectExpense(id, reason).subscribe({
        next: updated => {
          this.replaceExpenseInList(updated);
          completed++;
          if (completed === targetIds.length) {
            this.rejecting.set(false);
            this.showRejectModal.set(false);
            this.notificationService.success(`${completed} expense(s) rejected.`);
            this.selectedIds.set(new Set());
            this.updateKpiSummary();
          }
        },
        error: err => {
          this.rejecting.set(false);
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
    this.reimburseTargetIds.set(eligible.map(e => e.id));
    this.showReimburseModal.set(true);
  }

  confirmReimburse(): void {
    const bankId = this.selectedBankAccountId();
    if (!bankId) {
      this.notificationService.warning('Please select a payment bank/cash account.');
      return;
    }
    this.reimbursing.set(true);
    const request: BatchReimburseRequest = {
      expenseIds: this.reimburseTargetIds(),
      bankAccountId: bankId,
      paymentDate: this.reimbursementDate()
    };

    this.expenseService.reimburseExpenses(request).subscribe({
      next: res => {
        this.reimbursing.set(false);
        this.showReimburseModal.set(false);
        this.notificationService.success(
          `Reimbursed ${res.processedCount} claims (Total: AED ${res.totalAmount.toFixed(2)}) via entry ${res.journalEntryNo || 'JV'}.`
        );
        this.selectedIds.set(new Set());
        this.loadExpenses();
      },
      error: err => {
        this.reimbursing.set(false);
        const msg = err?.error?.message || 'Failed to process reimbursement.';
        this.notificationService.error(msg);
      }
    });
  }

  // Details Modal
  viewDetails(expense: Expense): void {
    this.selectedExpense.set(expense);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedExpense.set(null);
  }

  private replaceExpenseInList(updated: Expense): void {
    this.expensesPage.update(page => {
      const idx = page.content.findIndex(e => e.id === updated.id);
      if (idx === -1) return page;
      const nextContent = [...page.content];
      nextContent[idx] = updated;
      return { ...page, content: nextContent };
    });
    this.updateKpiSummary();
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

