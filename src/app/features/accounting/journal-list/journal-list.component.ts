import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

  journalsPage: Page<JournalEntry> = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  };

  loading = false;
  selectedJournal: JournalEntry | null = null;
  reversalReason = '';
  showReversalModal = false;
  journalToReverse: JournalEntry | null = null;

  // Filter state
  filterFrom: string = '';
  filterTo: string = '';
  filterStatus: JournalStatus | '' = '';
  filterSourceType: JournalSourceType | '' = '';

  pageSize = 15;
  currentPage = 0;

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
      this.currentPage = params['page'] !== undefined ? Number(params['page']) : 0;
      this.pageSize = params['size'] !== undefined ? Number(params['size']) : 15;
      this.filterFrom = params['from'] || '';
      this.filterTo = params['to'] || '';
      this.filterStatus = params['status'] || '';
      this.filterSourceType = params['sourceType'] || '';

      this.loadJournals();
    });
  }

  loadJournals(): void {
    this.loading = true;
    const query: JournalQuery = {
      page: this.currentPage,
      size: this.pageSize,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      status: (this.filterStatus as JournalStatus) || undefined,
      sourceType: (this.filterSourceType as JournalSourceType) || undefined
    };

    this.journalService.getJournalEntries(query).subscribe({
      next: (page) => {
        this.journalsPage = page;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.updateQueryParams();
  }

  resetFilters(): void {
    this.filterFrom = '';
    this.filterTo = '';
    this.filterStatus = '';
    this.filterSourceType = '';
    this.currentPage = 0;
    this.updateQueryParams();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.journalsPage.totalPages) {
      this.currentPage = page;
      this.updateQueryParams();
    }
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage,
        size: this.pageSize,
        from: this.filterFrom || null,
        to: this.filterTo || null,
        status: this.filterStatus || null,
        sourceType: this.filterSourceType || null
      },
      queryParamsHandling: 'merge'
    });
  }

  viewDetails(journal: JournalEntry): void {
    this.journalService.getJournalEntryById(journal.id).subscribe({
      next: (fullEntry) => {
        this.selectedJournal = fullEntry;
      }
    });
  }

  closeDetails(): void {
    this.selectedJournal = null;
  }

  postDraft(journal: JournalEntry): void {
    if (!confirm(`Are you sure you want to post journal entry ${journal.entryNo}?`)) {
      return;
    }
    this.journalService.postJournalEntry(journal.id).subscribe({
      next: () => {
        this.notificationService.success(`Journal entry ${journal.entryNo} posted successfully.`);
        this.loadJournals();
        if (this.selectedJournal && this.selectedJournal.id === journal.id) {
          this.closeDetails();
        }
      }
    });
  }

  openReversalModal(journal: JournalEntry): void {
    this.journalToReverse = journal;
    this.reversalReason = '';
    this.showReversalModal = true;
  }

  closeReversalModal(): void {
    this.showReversalModal = false;
    this.journalToReverse = null;
    this.reversalReason = '';
  }

  confirmReversal(): void {
    if (!this.journalToReverse) return;
    this.journalService.reverseJournalEntry(this.journalToReverse.id, this.reversalReason).subscribe({
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

