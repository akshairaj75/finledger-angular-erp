import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { Bill, BillQuery, BillStatus } from '../../../core/models/bill.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import { BillService } from '../services/bill.service';

interface SummaryCards {
  draftCount: number;
  unpaidTotal: number;
  overdueTotal: number;
  paidThisMonthTotal: number;
}

@Component({
  selector: 'app-bill-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasPermissionDirective],
  templateUrl: './bill-list.component.html',
  styleUrls: ['./bill-list.component.css']
})
export class BillListComponent implements OnInit {
  private billService = inject(BillService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  billsPage = signal<Page<Bill>>({
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  });

  summary = signal<SummaryCards>({
    draftCount: 0,
    unpaidTotal: 0,
    overdueTotal: 0,
    paidThisMonthTotal: 0
  });

  loading = signal(false);
  currentPage = signal(0);
  pageSize = 15;

  // Filter state
  searchQuery = signal('');
  filterStatus = signal<BillStatus | ''>('');
  filterFrom = signal('');
  filterTo = signal('');

  readonly statuses: BillStatus[] = ['DRAFT', 'APPROVED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];

  // Detail Modal
  selectedBill = signal<Bill | null>(null);
  showDetailModal = signal(false);

  // Void Modal
  showVoidModal = signal(false);
  billToVoid = signal<Bill | null>(null);
  voidReason = signal('');
  voiding = signal(false);

  // Approving
  approvingId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchQuery.set(params['q'] || '');
      this.filterStatus.set((params['status'] as BillStatus) || '');
      this.filterFrom.set(params['from'] || '');
      this.filterTo.set(params['to'] || '');
      this.currentPage.set(params['page'] ? Number(params['page']) : 0);
      this.loadBills();
    });
  }

  loadBills(): void {
    this.loading.set(true);
    const query: BillQuery = {
      page: this.currentPage(),
      size: this.pageSize
    };

    this.billService.getBills(query).subscribe({
      next: page => {
        let items = page.content;
        const st = this.filterStatus();
        const fFrom = this.filterFrom();
        const fTo = this.filterTo();
        const sq = this.searchQuery().trim();

        // In-memory filter for status, dates, and search query
        if (st) {
          items = items.filter(b => b.status === st);
        }
        if (fFrom) {
          items = items.filter(b => b.billDate >= fFrom);
        }
        if (fTo) {
          items = items.filter(b => b.billDate <= fTo);
        }
        if (sq) {
          const q = sq.toLowerCase();
          items = items.filter(
            b =>
              (b.billNo && b.billNo.toLowerCase().includes(q)) ||
              (b.vendorInvoiceNo && b.vendorInvoiceNo.toLowerCase().includes(q)) ||
              (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
              (b.vendorCode && b.vendorCode.toLowerCase().includes(q))
          );
        }

        this.billsPage.set({
          ...page,
          content: items
        });
        this.loading.set(false);
        this.calculateSummary(page.content);
      },
      error: err => {
        this.loading.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load bills');
      }
    });
  }

  private calculateSummary(bills: Bill[]): void {
    const today = new Date().toISOString().substring(0, 10);
    const currentYearMonth = today.substring(0, 7);

    let draftCount = 0;
    let unpaidTotal = 0;
    let overdueTotal = 0;
    let paidThisMonthTotal = 0;

    for (const b of bills) {
      if (b.status === 'DRAFT') {
        draftCount++;
      }
      if (b.status !== 'VOID' && b.status !== 'PAID') {
        unpaidTotal += b.balanceDue || 0;
      }
      const isPastDue = b.dueDate && b.dueDate < today && (b.balanceDue || 0) > 0;
      if (b.status === 'OVERDUE' || isPastDue) {
        overdueTotal += b.balanceDue || 0;
      }
      if (b.billDate && b.billDate.startsWith(currentYearMonth)) {
        paidThisMonthTotal += b.amountPaid || 0;
      }
    }

    this.summary.set({
      draftCount,
      unpaidTotal,
      overdueTotal,
      paidThisMonthTotal
    });
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.syncQueryParams();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.filterFrom.set('');
    this.filterTo.set('');
    this.currentPage.set(0);
    this.syncQueryParams();
  }

  private syncQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery().trim() || null,
        status: this.filterStatus() || null,
        from: this.filterFrom() || null,
        to: this.filterTo() || null,
        page: this.currentPage() > 0 ? this.currentPage() : null
      },
      queryParamsHandling: 'merge'
    });
  }

  goToPage(p: number): void {
    if (p >= 0 && p < this.billsPage().totalPages) {
      this.currentPage.set(p);
      this.syncQueryParams();
    }
  }

  approveBill(bill: Bill, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.approvingId.set(bill.id);
    this.billService.approveBill(bill.id).subscribe({
      next: updated => {
        this.approvingId.set(null);
        this.notificationService.success(`Bill ${updated.billNo} approved and posted to General Ledger!`);
        this.loadBills();
        const sel = this.selectedBill();
        if (sel && sel.id === bill.id) {
          this.selectedBill.set(updated);
        }
      },
      error: err => {
        this.approvingId.set(null);
        this.notificationService.error(err?.error?.message || 'Failed to approve bill');
      }
    });
  }

  openVoidModal(bill: Bill, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.billToVoid.set(bill);
    this.voidReason.set('');
    this.showVoidModal.set(true);
  }

  closeVoidModal(): void {
    this.showVoidModal.set(false);
    this.billToVoid.set(null);
    this.voidReason.set('');
  }

  confirmVoid(): void {
    const target = this.billToVoid();
    if (!target) return;
    this.voiding.set(true);
    this.billService.voidBill(target.id, this.voidReason()).subscribe({
      next: () => {
        this.voiding.set(false);
        this.notificationService.success(`Bill ${target.billNo} voided and reversing entry created.`);
        this.closeVoidModal();
        this.loadBills();
        const sel = this.selectedBill();
        if (sel && sel.id === target.id) {
          this.closeDetailModal();
        }
      },
      error: err => {
        this.voiding.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to void bill');
      }
    });
  }

  viewDetails(bill: Bill): void {
    this.selectedBill.set(bill);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedBill.set(null);
  }

  getStatusClass(status: BillStatus): string {
    switch (status) {
      case 'DRAFT': return 'chip-draft';
      case 'APPROVED': return 'chip-sent';
      case 'PARTIAL': return 'chip-partial';
      case 'PAID': return 'chip-paid';
      case 'OVERDUE': return 'chip-overdue';
      case 'VOID': return 'chip-void';
      default: return 'chip-draft';
    }
  }

  isOverdue(bill: Bill): boolean {
    if (bill.status === 'PAID' || bill.status === 'VOID') return false;
    const today = new Date().toISOString().substring(0, 10);
    return bill.dueDate < today && bill.balanceDue > 0;
  }
}

