import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { JournalEntry, JournalQuery, JournalSourceType, JournalStatus } from '../../../core/models/journal.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import { JournalService } from '../services/journal.service';

@Component({
  selector: 'app-journal-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasPermissionDirective],
  templateUrl: './journal-list.component.html',
  styleUrls: ['./journal-list.component.css']
})
export class JournalListComponent implements OnInit {
  private journalService = inject(JournalService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  journalsPage = signal<Page<JournalEntry>>({
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  });

  loading = signal(false);
  selectedJournal = signal<JournalEntry | null>(null);
  reversalReason = signal('');
  showReversalModal = signal(false);
  journalToReverse = signal<JournalEntry | null>(null);

  // Filter state
  filterFrom = signal<string>('');
  filterTo = signal<string>('');
  filterStatus = signal<JournalStatus | ''>('');
  filterSourceType = signal<JournalSourceType | ''>('');

  pageSize = signal(15);
  currentPage = signal(0);

  readonly statuses: JournalStatus[] = ['DRAFT', 'POSTED', 'VOID'];
  readonly sourceTypes: JournalSourceType[] = [
    'MANUAL',
    'INVOICE',
    'BILL',
    'RECEIPT',
    'PAYMENT',
    'CREDIT_NOTE',
    'EXPENSE',
    'REIMBURSEMENT',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'OPENING',
    'CLOSING'
  ];

  ngOnInit(): void {
    // Synchronize filters from route query params for bookmarking
    this.route.queryParams.subscribe(params => {
      this.currentPage.set(params['page'] !== undefined ? Number(params['page']) : 0);
      this.pageSize.set(params['size'] !== undefined ? Number(params['size']) : 15);
      this.filterFrom.set(params['from'] || '');
      this.filterTo.set(params['to'] || '');
      this.filterStatus.set(params['status'] || '');
      this.filterSourceType.set(params['sourceType'] || '');

      this.loadJournals();
    });
  }

  loadJournals(): void {
    this.loading.set(true);
    const query: JournalQuery = {
      page: this.currentPage(),
      size: this.pageSize(),
      from: this.filterFrom() || undefined,
      to: this.filterTo() || undefined,
      status: (this.filterStatus() as JournalStatus) || undefined,
      sourceType: (this.filterSourceType() as JournalSourceType) || undefined
    };

    this.journalService.getJournalEntries(query).subscribe({
      next: (page) => {
        this.journalsPage.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.updateQueryParams();
  }

  resetFilters(): void {
    this.filterFrom.set('');
    this.filterTo.set('');
    this.filterStatus.set('');
    this.filterSourceType.set('');
    this.currentPage.set(0);
    this.updateQueryParams();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.journalsPage().totalPages) {
      this.currentPage.set(page);
      this.updateQueryParams();
    }
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage(),
        size: this.pageSize(),
        from: this.filterFrom() || null,
        to: this.filterTo() || null,
        status: this.filterStatus() || null,
        sourceType: this.filterSourceType() || null
      },
      queryParamsHandling: 'merge'
    });
  }

  viewDetails(journal: JournalEntry): void {
    this.journalService.getJournalEntryById(journal.id).subscribe({
      next: (fullEntry) => {
        this.selectedJournal.set(fullEntry);
      }
    });
  }

  closeDetails(): void {
    this.selectedJournal.set(null);
  }

  postDraft(journal: JournalEntry): void {
    if (!confirm(`Are you sure you want to post journal entry ${journal.entryNo}?`)) {
      return;
    }
    this.journalService.postJournalEntry(journal.id).subscribe({
      next: () => {
        this.notificationService.success(`Journal entry ${journal.entryNo} posted successfully.`);
        this.loadJournals();
        const selected = this.selectedJournal();
        if (selected && selected.id === journal.id) {
          this.closeDetails();
        }
      }
    });
  }

  openReversalModal(journal: JournalEntry): void {
    this.journalToReverse.set(journal);
    this.reversalReason.set('');
    this.showReversalModal.set(true);
  }

  closeReversalModal(): void {
    this.showReversalModal.set(false);
    this.journalToReverse.set(null);
    this.reversalReason.set('');
  }

  confirmReversal(): void {
    const target = this.journalToReverse();
    if (!target) return;
    this.journalService.reverseJournalEntry(target.id, this.reversalReason()).subscribe({
      next: (rev) => {
        this.notificationService.success(`Reversal entry ${rev.entryNo} created and original entry voided.`);
        this.closeReversalModal();
        this.closeDetails();
        this.loadJournals();
      }
    });
  }

  getStatusClass(status: JournalStatus): string {
    switch (status) {
      case 'POSTED':
        return 'badge-posted';
      case 'DRAFT':
        return 'badge-draft';
      case 'VOID':
        return 'badge-void';
      default:
        return '';
    }
  }
}

