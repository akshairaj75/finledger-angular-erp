import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { Invoice, InvoiceQuery, InvoiceStatus } from '../../../core/models/invoice.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import { InvoiceService } from '../services/invoice.service';

interface SummaryCards {
  draftCount: number;
  unpaidTotal: number;
  overdueTotal: number;
  paidThisMonthTotal: number;
}

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasPermissionDirective],
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.css']
})
export class InvoiceListComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  invoicesPage: Page<Invoice> = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  };

  allInvoicesForSummary: Invoice[] = [];
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
  filterStatus: InvoiceStatus | '' = '';
  filterFrom = '';
  filterTo = '';

  readonly statuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];

  // Detail Modal
  selectedInvoice: Invoice | null = null;
  showDetailModal = false;

  // Void Modal
  showVoidModal = false;
  invoiceToVoid: Invoice | null = null;
  voidReason = '';
  voiding = false;

  // Action in progress
  sendingId: number | null = null;
  pdfLoadingId: number | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      this.filterStatus = (params['status'] as InvoiceStatus) || '';
      this.filterFrom = params['from'] || '';
      this.filterTo = params['to'] || '';
      this.currentPage = params['page'] ? Number(params['page']) : 0;
      this.loadInvoices();
    });
  }

  loadInvoices(): void {
    this.loading = true;
    const query: InvoiceQuery = {
      page: this.currentPage,
      size: this.pageSize,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      status: this.filterStatus || undefined
    };

    this.invoiceService.getInvoices(query).subscribe({
      next: page => {
        let items = page.content;
        // In-memory filter for search query across invoiceNo and customerName
        if (this.searchQuery.trim()) {
          const q = this.searchQuery.toLowerCase().trim();
          items = items.filter(
            inv =>
              (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
              (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
              (inv.customerCode && inv.customerCode.toLowerCase().includes(q))
          );
        }
        this.invoicesPage = {
          ...page,
          content: items
        };
        this.loading = false;
        this.calculateSummary(page.content);
      },
      error: err => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Failed to load invoices');
      }
    });
  }

  private calculateSummary(invoices: Invoice[]): void {
    const today = new Date().toISOString().substring(0, 10);
    const currentYearMonth = today.substring(0, 7); // YYYY-MM

    let draftCount = 0;
    let unpaidTotal = 0;
    let overdueTotal = 0;
    let paidThisMonthTotal = 0;

    for (const inv of invoices) {
      if (inv.status === 'DRAFT') {
        draftCount++;
      }
      if (inv.status !== 'VOID' && inv.status !== 'PAID') {
        unpaidTotal += inv.balanceDue || 0;
      }
      const isPastDue = inv.dueDate && inv.dueDate < today && (inv.balanceDue || 0) > 0;
      if (inv.status === 'OVERDUE' || isPastDue) {
        overdueTotal += inv.balanceDue || 0;
      }
      if (inv.invoiceDate && inv.invoiceDate.startsWith(currentYearMonth)) {
        paidThisMonthTotal += inv.amountPaid || 0;
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
    if (p >= 0 && p < this.invoicesPage.totalPages) {
      this.currentPage = p;
      this.syncQueryParams();
    }
  }

  sendInvoice(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.sendingId = invoice.id;
    this.invoiceService.sendInvoice(invoice.id).subscribe({
      next: updated => {
        this.sendingId = null;
        this.notificationService.success(`Invoice ${updated.invoiceNo} posted to GL and marked SENT!`);
        this.loadInvoices();
        if (this.selectedInvoice && this.selectedInvoice.id === invoice.id) {
          this.selectedInvoice = updated;
        }
      },
      error: err => {
        this.sendingId = null;
        this.notificationService.error(err?.error?.message || 'Failed to send and post invoice');
      }
    });
  }

  downloadPdf(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pdfLoadingId = invoice.id;
    this.invoiceService.getInvoicePdf(invoice.id).subscribe({
      next: blob => {
        this.pdfLoadingId = null;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${invoice.invoiceNo || 'invoice'}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      },
      error: err => {
        this.pdfLoadingId = null;
        this.notificationService.error(err?.error?.message || 'Failed to download invoice PDF');
      }
    });
  }

  openVoidModal(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.invoiceToVoid = invoice;
    this.voidReason = '';
    this.showVoidModal = true;
  }

  closeVoidModal(): void {
    this.showVoidModal = false;
    this.invoiceToVoid = null;
    this.voidReason = '';
  }

  confirmVoid(): void {
    if (!this.invoiceToVoid) return;
    this.voiding = true;
    this.invoiceService.voidInvoice(this.invoiceToVoid.id, this.voidReason).subscribe({
      next: () => {
        this.voiding = false;
        this.notificationService.success(`Invoice ${this.invoiceToVoid?.invoiceNo} voided and reversing entry created.`);
        this.closeVoidModal();
        this.loadInvoices();
        if (this.selectedInvoice && this.selectedInvoice.id === this.invoiceToVoid?.id) {
          this.closeDetailModal();
        }
      },
      error: err => {
        this.voiding = false;
        this.notificationService.error(err?.error?.message || 'Failed to void invoice');
      }
    });
  }

  viewDetails(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedInvoice = null;
  }

  getStatusClass(status: InvoiceStatus): string {
    switch (status) {
      case 'DRAFT': return 'chip-draft';
      case 'SENT': return 'chip-sent';
      case 'PARTIAL': return 'chip-partial';
      case 'PAID': return 'chip-paid';
      case 'OVERDUE': return 'chip-overdue';
      case 'VOID': return 'chip-void';
      default: return 'chip-draft';
    }
  }

  isOverdue(invoice: Invoice): boolean {
    if (invoice.status === 'PAID' || invoice.status === 'VOID') return false;
    const today = new Date().toISOString().substring(0, 10);
    return invoice.dueDate < today && invoice.balanceDue > 0;
  }
}

