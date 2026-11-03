import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './bill-list.component.html',
  styleUrls: ['./bill-list.component.css']
})
export class BillListComponent implements OnInit {
  private billService = inject(BillService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  billsPage: Page<Bill> = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  };

  summary: SummaryCards = {
    draftCount: 0,
    unpaidTotal: 0,
    overdueTotal: 0,
    paidThisMonthTotal: 0
  };

  loading = false;
  currentPage = 0;
  pageSize = 15;

  // Filter state
  searchQuery = '';
  filterStatus: BillStatus | '' = '';
  filterFrom = '';
  filterTo = '';

  readonly statuses: BillStatus[] = ['DRAFT', 'APPROVED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];

  // Detail Modal
  selectedBill: Bill | null = null;
  showDetailModal = false;

  // Void Modal
  showVoidModal = false;
  billToVoid: Bill | null = null;
  voidReason = '';
  voiding = false;

  // Approving
  approvingId: number | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      this.filterStatus = (params['status'] as BillStatus) || '';
      this.filterFrom = params['from'] || '';
      this.filterTo = params['to'] || '';
      this.currentPage = params['page'] ? Number(params['page']) : 0;
      this.loadBills();
    });
  }

  loadBills(): void {
    this.loading = true;
    const query: BillQuery = {
      page: this.currentPage,
      size: this.pageSize
    };

    this.billService.getBills(query).subscribe({
      next: page => {
        let items = page.content;

        // In-memory filter for status, dates, and search query
        if (this.filterStatus) {
          items = items.filter(b => b.status === this.filterStatus);
        }
        if (this.filterFrom) {
          items = items.filter(b => b.billDate >= this.filterFrom);
        }
        if (this.filterTo) {
          items = items.filter(b => b.billDate <= this.filterTo);
        }
        if (this.searchQuery.trim()) {
          const q = this.searchQuery.toLowerCase().trim();
          items = items.filter(
            b =>
              (b.billNo && b.billNo.toLowerCase().includes(q)) ||
              (b.vendorInvoiceNo && b.vendorInvoiceNo.toLowerCase().includes(q)) ||
              (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
              (b.vendorCode && b.vendorCode.toLowerCase().includes(q))
          );
        }

        this.billsPage = {
          ...page,
          content: items
        };
        this.loading = false;
        this.calculateSummary(page.content);
      },
      error: err => {
        this.loading = false;
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

    this.summary = {
      draftCount,
      unpaidTotal,
      overdueTotal,
      paidThisMonthTotal
    };
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.syncQueryParams();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.currentPage = 0;
    this.syncQueryParams();
  }

  private syncQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery.trim() || null,
        status: this.filterStatus || null,
        from: this.filterFrom || null,
        to: this.filterTo || null,
        page: this.currentPage > 0 ? this.currentPage : null
      },
      queryParamsHandling: 'merge'
    });
  }

  goToPage(p: number): void {
    if (p >= 0 && p < this.billsPage.totalPages) {
      this.currentPage = p;
      this.syncQueryParams();
    }
  }

  approveBill(bill: Bill, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.approvingId = bill.id;
    this.billService.approveBill(bill.id).subscribe({
      next: updated => {
        this.approvingId = null;
        this.notificationService.success(`Bill ${updated.billNo} approved and posted to General Ledger!`);
        this.loadBills();
        if (this.selectedBill && this.selectedBill.id === bill.id) {
          this.selectedBill = updated;
        }
      },
      error: err => {
        this.approvingId = null;
        this.notificationService.error(err?.error?.message || 'Failed to approve bill');
      }
    });
  }

  openVoidModal(bill: Bill, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.billToVoid = bill;
    this.voidReason = '';
    this.showVoidModal = true;
  }

  closeVoidModal(): void {
    this.showVoidModal = false;
    this.billToVoid = null;
    this.voidReason = '';
  }

  confirmVoid(): void {
    if (!this.billToVoid) return;
    this.voiding = true;
    this.billService.voidBill(this.billToVoid.id, this.voidReason).subscribe({
      next: () => {
        this.voiding = false;
        this.notificationService.success(`Bill ${this.billToVoid?.billNo} voided and reversing entry created.`);
        this.closeVoidModal();
        this.loadBills();
        if (this.selectedBill && this.selectedBill.id === this.billToVoid?.id) {
          this.closeDetailModal();
        }
      },
      error: err => {
        this.voiding = false;
        this.notificationService.error(err?.error?.message || 'Failed to void bill');
      }
    });
  }

  viewDetails(bill: Bill): void {
    this.selectedBill = bill;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedBill = null;
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

