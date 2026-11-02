import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

  accounts: Account[] = [];
  selectedAccountId: number | null = null;
  fromDate: string = '';
  toDate: string = '';

  report: GeneralLedgerReport | null = null;
  loading = false;
  hasSearched = false;

  ngOnInit(): void {
    // Load accounts
    this.accountService.getAccounts(0, 500).subscribe({
      next: (page) => {
        this.accounts = page.content.filter(a => !a.isGroup && a.isActive);

        // Check query params
        this.route.queryParams.subscribe(params => {
          if (params['accountId']) {
            this.selectedAccountId = Number(params['accountId']);
          } else if (this.accounts.length > 0 && !this.selectedAccountId) {
            // Default to first account (e.g. Cash or Bank)
            this.selectedAccountId = this.accounts[0].id;
          }

          if (params['from']) {
            this.fromDate = params['from'];
          } else if (!this.fromDate) {
            const now = new Date();
            this.fromDate = new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10);
          }

          if (params['to']) {
            this.toDate = params['to'];
          } else if (!this.toDate) {
            this.toDate = new Date().toISOString().substring(0, 10);
          }

          if (this.selectedAccountId) {
            this.fetchReport();
          }
        });
      }
    });
  }

  fetchReport(): void {
    if (!this.selectedAccountId) return;

    this.loading = true;
    this.hasSearched = true;

    // Update query params for bookmarking
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        accountId: this.selectedAccountId,
        from: this.fromDate || null,
        to: this.toDate || null
      },
      queryParamsHandling: 'merge'
    });

    this.ledgerService.getGeneralLedgerReport(this.selectedAccountId, this.fromDate, this.toDate).subscribe({
      next: (data) => {
        this.report = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get selectedAccount(): Account | undefined {
    return this.accounts.find(a => a.id === this.selectedAccountId);
  }
}

