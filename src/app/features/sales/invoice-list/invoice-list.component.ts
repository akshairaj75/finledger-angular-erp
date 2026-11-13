import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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

  invoicesPage = signal<Page<Invoice>>({
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
  filterStatus = signal<InvoiceStatus | ''>('');
  filterFrom = signal('');
  filterTo = signal('');

  readonly statuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];

  // Detail Modal
  selectedInvoice = signal<Invoice | null>(null);
  showDetailModal = signal(false);

  // Void Modal
  showVoidModal = signal(false);
  invoiceToVoid = signal<Invoice | null>(null);
  voidReason = signal('');
  voiding = signal(false);

  // Action in progress
  sendingId = signal<number | null>(null);
  pdfLoadingId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchQuery.set(params['q'] || '');
      this.filterStatus.set((params['status'] as InvoiceStatus) || '');
      this.filterFrom.set(params['from'] || '');
      this.filterTo.set(params['to'] || '');
      this.currentPage.set(params['page'] ? Number(params['page']) : 0);
      this.loadInvoices();
    });
  }

  loadInvoices(): void {
    this.loading.set(true);
    const query: InvoiceQuery = {
      page: this.currentPage(),
      size: this.pageSize,
      from: this.filterFrom() || undefined,
      to: this.filterTo() || undefined,
      status: this.filterStatus() || undefined,
      q: this.searchQuery().trim() || undefined
    };

    this.invoiceService.getInvoices(query).subscribe({
      next: page => {
        this.invoicesPage.set(page);
        this.loading.set(false);
        this.calculateSummary(page.content);
      },
      error: () => {
        this.loading.set(false);
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
    if (p >= 0 && p < this.invoicesPage().totalPages) {
      this.currentPage.set(p);
      this.syncQueryParams();
    }
  }

  sendInvoice(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.sendingId.set(invoice.id);
    this.invoiceService.sendInvoice(invoice.id).subscribe({
      next: updated => {
        this.sendingId.set(null);
        this.notificationService.success(`Invoice ${updated.invoiceNo} posted to GL and marked SENT!`);
        this.loadInvoices();
        const sel = this.selectedInvoice();
        if (sel && sel.id === invoice.id) {
          this.selectedInvoice.set(updated);
        }
      },
      error: () => {
        this.sendingId.set(null);
      }
    });
  }

  downloadPdf(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pdfLoadingId.set(invoice.id);
    this.invoiceService.getInvoicePdf(invoice.id).subscribe({
      next: blob => {
        this.pdfLoadingId.set(null);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${invoice.invoiceNo || 'invoice'}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      },
      error: () => {
        this.pdfLoadingId.set(null);
      }
    });
  }

  openVoidModal(invoice: Invoice, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.invoiceToVoid.set(invoice);
    this.voidReason.set('');
    this.showVoidModal.set(true);
  }

  closeVoidModal(): void {
    this.showVoidModal.set(false);
    this.invoiceToVoid.set(null);
    this.voidReason.set('');
  }

  confirmVoid(): void {
    const target = this.invoiceToVoid();
    if (!target) return;
    this.voiding.set(true);
    this.invoiceService.voidInvoice(target.id, this.voidReason()).subscribe({
      next: () => {
        this.voiding.set(false);
        this.notificationService.success(`Invoice ${target.invoiceNo} voided and reversing entry created.`);
        this.closeVoidModal();
        this.loadInvoices();
        const sel = this.selectedInvoice();
        if (sel && sel.id === target.id) {
          this.closeDetailModal();
        }
      },
      error: () => {
        this.voiding.set(false);
      }
    });
  }

  viewDetails(invoice: Invoice): void {
    this.selectedInvoice.set(invoice);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedInvoice.set(null);
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

