import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { GeneralLedgerReport } from '../../../core/models/report.model';
import { AccountService } from '../services/account.service';
import { LedgerService } from '../services/ledger.service';

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ledger.component.html',
  styleUrls: ['./ledger.component.css']
})
export class LedgerComponent implements OnInit {
  private ledgerService = inject(LedgerService);
  private accountService = inject(AccountService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  accounts = signal<Account[]>([]);
  selectedAccountId = signal<number | null>(null);
  fromDate = signal<string>('');
  toDate = signal<string>('');

  report = signal<GeneralLedgerReport | null>(null);
  loading = signal<boolean>(false);
  hasSearched = signal<boolean>(false);

  ngOnInit(): void {
    // Load accounts
    this.accountService.getAccounts(0, 500).subscribe({
      next: (page) => {
        const activeAccounts = page.content.filter(a => !a.isGroup && a.isActive);
        this.accounts.set(activeAccounts);

        // Check query params
        this.route.queryParams.subscribe(params => {
          if (params['accountId']) {
            this.selectedAccountId.set(Number(params['accountId']));
          } else if (activeAccounts.length > 0 && !this.selectedAccountId()) {
            // Default to first account (e.g. Cash or Bank)
            this.selectedAccountId.set(activeAccounts[0].id);
          }

          if (params['from']) {
            this.fromDate.set(params['from']);
          } else if (!this.fromDate()) {
            const now = new Date();
            this.fromDate.set(new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10));
          }

          if (params['to']) {
            this.toDate.set(params['to']);
          } else if (!this.toDate()) {
            this.toDate.set(new Date().toISOString().substring(0, 10));
          }

          if (this.selectedAccountId()) {
            this.fetchReport();
          }
        });
      }
    });
  }

  fetchReport(): void {
    const accountId = this.selectedAccountId();
    if (!accountId) return;

    this.loading.set(true);
    this.hasSearched.set(true);

    // Update query params for bookmarking
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        accountId,
        from: this.fromDate() || null,
        to: this.toDate() || null
      },
      queryParamsHandling: 'merge'
    });

    this.ledgerService.getGeneralLedgerReport(accountId, this.fromDate(), this.toDate()).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  selectedAccount = computed<Account | undefined>(() =>
    this.accounts().find(a => a.id === this.selectedAccountId())
  );
}

