import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankingService } from '../services/banking.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BankAccount } from '../../../core/models/bank-account.model';
import {
  BankReconciliation,
  BankStatementLine,
  BookTransaction,
  StartReconciliationRequest
} from '../../../core/models/banking.model';

@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reconciliation-page">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h2>Bank Account Reconciliation</h2>
          <p class="subtitle">Match statement lines with book transactions and clear outstanding entries</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="openUploadModal()">
            <span class="icon">📤</span> Import Statement (CSV)
          </button>
          <button
            class="btn btn-primary"
            (click)="handleAutoMatch()"
            [disabled]="!currentReconciliation() || currentReconciliation()?.status === 'COMPLETED' || loading()"
          >
            <span class="icon">⚡</span> Auto-Match Pairs
          </button>
          <button
            class="btn btn-success"
            (click)="handleComplete()"
            [disabled]="!canComplete() || loading()"
          >
            <span class="icon">✓</span> Finish Reconciliation
          </button>
        </div>
      </div>

      <!-- Account & Setup Bar -->
      <div class="card setup-card">
        <div class="setup-grid">
          <div class="form-group">
            <label>Bank Account</label>
            <select [ngModel]="selectedAccountId()" (ngModelChange)="selectedAccountId.set($event); onAccountChange()" class="form-control">
              <option [ngValue]="null" disabled>Select Bank Account...</option>
              <option *ngFor="let acc of bankAccounts()" [ngValue]="acc.id">
                {{ acc.name }} ({{ acc.currencyCode }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Statement Cut-Off Date</label>
            <input type="date" [ngModel]="statementDate()" (ngModelChange)="statementDate.set($event)" class="form-control" />
          </div>

          <div class="form-group">
            <label>Ending Statement Balance</label>
            <input
              type="number"
              step="0.01"
              [ngModel]="statementBalance()"
              (ngModelChange)="statementBalance.set($event)"
              placeholder="0.00"
              class="form-control"
            />
          </div>

          <div class="form-group align-end">
            <button
              class="btn btn-primary w-100"
              (click)="startOrLoadReconciliation()"
              [disabled]="!selectedAccountId() || !statementDate() || loading()"
            >
              {{ currentReconciliation() ? 'Refresh Reconciliation' : 'Start Reconciliation' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Reconciliation Live Balance Strip -->
      <div class="kpi-strip" *ngIf="currentReconciliation() as recon">
        <div class="kpi-card">
          <span class="kpi-label">Statement Balance</span>
          <span class="kpi-val">{{ recon.statementBalance | number:'1.2-2' }}</span>
          <span class="kpi-sub">Per imported bank statement</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Cleared Book Balance</span>
          <span class="kpi-val">{{ recon.bookBalance | number:'1.2-2' }}</span>
          <span class="kpi-sub">Cleared ledger balance</span>
        </div>

        <div
          class="kpi-card"
          [ngClass]="{
            'kpi-balanced': isBalanced(),
            'kpi-unbalanced': !isBalanced()
          }"
        >
          <span class="kpi-label">Reconciliation Difference</span>
          <span class="kpi-val difference-val">{{ recon.difference | number:'1.2-2' }}</span>
          <span class="kpi-sub badge" [ngClass]="isBalanced() ? 'badge-success' : 'badge-danger'">
            {{ isBalanced() ? '✓ STRICTLY BALANCED (0.00)' : 'UNRECONCILED DIFFERENCE' }}
          </span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Reconciliation Status</span>
          <span class="kpi-val status-val" [ngClass]="recon.status === 'COMPLETED' ? 'text-success' : 'text-primary'">
            {{ recon.status }}
          </span>
          <span class="kpi-sub">
            {{ recon.matchedCount }} Matched |
            {{ recon.unmatchedStatementCount }} Stmt Unmatched |
            {{ recon.unmatchedBookCount }} Book Open
          </span>
        </div>
      </div>

      <!-- Manual Match Selection Bar -->
      <div class="manual-match-bar" *ngIf="selectedStmtLineId() || selectedBookLineId()">
        <div class="match-info">
          <span *ngIf="selectedStmtLineId()">
            Statement Line #{{ selectedStmtLineId() }} ({{ getSelectedStmtLine()?.amount | number:'1.2-2' }})
          </span>
          <span class="connector" *ngIf="selectedStmtLineId() && selectedBookLineId()"> ↔ </span>
          <span *ngIf="selectedBookLineId()">
            Book Entry #{{ selectedBookLineId() }} ({{ getSelectedBookLine()?.netAmount | number:'1.2-2' }})
          </span>
        </div>
        <div class="match-actions">
          <button
            class="btn btn-sm btn-primary"
            *ngIf="selectedStmtLineId() && selectedBookLineId()"
            (click)="handleManualMatch()"
          >
            Confirm Match
          </button>
          <button class="btn btn-sm btn-light" (click)="clearSelection()">Cancel</button>
        </div>
      </div>

      <!-- Side-by-Side Reconciliation Split View -->
      <div class="recon-split-container" *ngIf="currentReconciliation() as recon">
        <!-- Left Panel: Statement Lines (Imported CSV) -->
        <div class="recon-panel left-panel">
          <div class="panel-header">
            <h3>Bank Statement Transactions</h3>
            <span class="count-badge">{{ recon.statementLines.length }} lines</span>
          </div>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 32px"></th>
                  <th>Date</th>
                  <th>Description & Ref</th>
                  <th class="text-right">Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let line of recon.statementLines"
                  [class.row-selected]="selectedStmtLineId() === line.id"
                  [class.row-matched]="line.matchStatus === 'MATCHED'"
                >
                  <td>
                    <input
                      type="radio"
                      name="selectedStmtLine"
                      [checked]="selectedStmtLineId() === line.id"
                      (change)="selectStmtLine(line.id)"
                      [disabled]="line.matchStatus === 'MATCHED'"
                    />
                  </td>
                  <td>{{ line.txnDate }}</td>
                  <td>
                    <div class="desc-main">{{ line.description || '-' }}</div>
                    <div class="desc-ref" *ngIf="line.reference">{{ line.reference }}</div>
                  </td>
                  <td
                    class="text-right font-weight-bold"
                    [ngClass]="line.amount >= 0 ? 'text-success' : 'text-danger'"
                  >
                    {{ line.amount | number:'1.2-2' }}
                  </td>
                  <td>
                    <span
                      class="status-pill"
                      [ngClass]="{
                        'pill-matched': line.matchStatus === 'MATCHED',
                        'pill-suggested': line.matchStatus === 'SUGGESTED',
                        'pill-unmatched': line.matchStatus === 'UNMATCHED'
                      }"
                    >
                      {{ line.matchStatus }}
                    </span>
                  </td>
                  <td>
                    <button
                      *ngIf="line.matchStatus === 'MATCHED' && recon.status === 'IN_PROGRESS'"
                      class="btn btn-xs btn-outline-danger"
                      (click)="handleUnmatch(line.id)"
                      title="Unmatch this statement line"
                    >
                      Unmatch
                    </button>
                    <button
                      *ngIf="line.matchStatus !== 'MATCHED' && line.amount < 0 && recon.status === 'IN_PROGRESS'"
                      class="btn btn-xs btn-outline-warning"
                      (click)="openBankChargeModal(line)"
                      title="Convert fee directly to journal entry"
                    >
                      + Bank Fee
                    </button>
                  </td>
                </tr>
                <tr *ngIf="recon.statementLines.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">
                    No statement lines found. Click "Import Statement (CSV)" to upload bank statement.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right Panel: Unreconciled Book Transactions -->
        <div class="recon-panel right-panel">
          <div class="panel-header">
            <h3>Book Transactions (General Ledger)</h3>
            <span class="count-badge">{{ recon.bookTransactions.length }} lines</span>
          </div>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 32px"></th>
                  <th>Date</th>
                  <th>Entry / Reference</th>
                  <th class="text-right">Debit</th>
                  <th class="text-right">Credit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let book of recon.bookTransactions"
                  [class.row-selected]="selectedBookLineId() === book.journalLineId"
                  [class.row-matched]="book.isReconciled"
                >
                  <td>
                    <input
                      type="radio"
                      name="selectedBookLine"
                      [checked]="selectedBookLineId() === book.journalLineId"
                      (change)="selectBookLine(book.journalLineId)"
                      [disabled]="book.isReconciled"
                    />
                  </td>
                  <td>{{ book.entryDate }}</td>
                  <td>
                    <div class="desc-main">{{ book.entryNo }}</div>
                    <div class="desc-ref">{{ book.description || book.reference || '-' }}</div>
                  </td>
                  <td class="text-right">
                    {{ book.debit > 0 ? (book.debit | number:'1.2-2') : '-' }}
                  </td>
                  <td class="text-right">
                    {{ book.credit > 0 ? (book.credit | number:'1.2-2') : '-' }}
                  </td>
                  <td>
                    <span
                      class="status-pill"
                      [ngClass]="book.isReconciled ? 'pill-matched' : 'pill-unmatched'"
                    >
                      {{ book.isReconciled ? 'RECONCILED' : 'OPEN' }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="recon.bookTransactions.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">
                    No unreconciled book transactions up to statement date.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bank Statement CSV Upload Modal -->
      <div class="modal-backdrop" *ngIf="showUploadModal()">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Upload Bank Statement (CSV)</h3>
            <button class="close-btn" (click)="closeUploadModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Target Bank Account</label>
              <select [ngModel]="uploadAccountId()" (ngModelChange)="uploadAccountId.set($event)" class="form-control">
                <option *ngFor="let acc of bankAccounts()" [ngValue]="acc.id">
                  {{ acc.name }} ({{ acc.currencyCode }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Statement Cut-Off Date (optional)</label>
              <input type="date" [ngModel]="uploadDate()" (ngModelChange)="uploadDate.set($event)" class="form-control" />
            </div>
            <div class="form-group">
              <label>Select CSV Statement File</label>
              <input type="file" accept=".csv" (change)="onFileSelected($event)" class="form-control" />
            </div>
            <div class="csv-hint">
              Supported columns: Date (YYYY-MM-DD or DD/MM/YYYY), Description, Reference, Amount (or separate Debit/Credit).
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-light" (click)="closeUploadModal()">Cancel</button>
            <button
              class="btn btn-primary"
              [disabled]="!selectedFile() || !uploadAccountId() || loading()"
              (click)="handleUploadStatement()"
            >
              Upload & Process
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Bank Fee Modal -->
      <div class="modal-backdrop" *ngIf="showChargeModal()">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Quick Bank Fee / Charge Entry</h3>
            <button class="close-btn" (click)="closeChargeModal()">&times;</button>
          </div>
          <div class="modal-body" *ngIf="activeChargeLine() as chargeLine">
            <p>
              Instantly create a posted journal entry to record this bank charge and match it to line:
            </p>
            <div class="fee-summary">
              <div><strong>Date:</strong> {{ chargeLine.txnDate }}</div>
              <div><strong>Amount:</strong> {{ Math.abs(chargeLine.amount) | number:'1.2-2' }}</div>
              <div><strong>Narration:</strong> {{ chargeLine.description }}</div>
            </div>
            <div class="form-group mt-3">
              <label>Expense Narration</label>
              <input type="text" [ngModel]="chargeDescription()" (ngModelChange)="chargeDescription.set($event)" class="form-control" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-light" (click)="closeChargeModal()">Cancel</button>
            <button class="btn btn-warning" (click)="submitBankCharge()" [disabled]="loading()">
              Create Entry & Match
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reconciliation-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }

    .subtitle {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .card {
      background: #ffffff;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }

    .setup-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      align-items: end;
    }

    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      margin-bottom: 0.35rem;
    }

    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #1e293b;
      background: #fff;
    }

    .form-control:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    .align-end {
      display: flex;
      align-items: flex-end;
    }

    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .kpi-card.kpi-balanced {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .kpi-card.kpi-unbalanced {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .kpi-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .kpi-val {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }

    .difference-val {
      font-size: 1.75rem;
    }

    .kpi-sub {
      font-size: 0.75rem;
      color: #64748b;
    }

    .badge-success {
      background: #10b981;
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .badge-danger {
      background: #ef4444;
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .manual-match-bar {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      animation: fadeIn 0.2s ease;
    }

    .match-info {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1e40af;
    }

    .recon-split-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 1024px) {
      .recon-split-container {
        grid-template-columns: 1fr;
      }
    }

    .recon-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .panel-header {
      background: #f8fafc;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e293b;
    }

    .count-badge {
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
    }

    .table-wrapper {
      max-height: 520px;
      overflow-y: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .table th {
      background: #f8fafc;
      padding: 0.5rem 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .table td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .row-selected {
      background-color: #dbeafe !important;
    }

    .row-matched {
      background-color: #f8fafc;
      opacity: 0.8;
    }

    .desc-main {
      font-weight: 500;
      color: #0f172a;
    }

    .desc-ref {
      font-size: 0.7rem;
      color: #94a3b8;
    }

    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .pill-matched {
      background: #dcfce7;
      color: #15803d;
    }

    .pill-suggested {
      background: #fef3c7;
      color: #b45309;
    }

    .pill-unmatched {
      background: #fee2e2;
      color: #b91c1c;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #2563eb;
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #0284c7;
      color: #fff;
    }

    .btn-success {
      background: #10b981;
      color: #fff;
    }

    .btn-warning {
      background: #f59e0b;
      color: #fff;
    }

    .btn-light {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn-xs {
      padding: 0.15rem 0.4rem;
      font-size: 0.7rem;
    }

    .btn-outline-danger {
      border-color: #ef4444;
      color: #ef4444;
      background: transparent;
    }

    .btn-outline-warning {
      border-color: #f59e0b;
      color: #b45309;
      background: transparent;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .text-primary { color: #2563eb; }
    .font-weight-bold { font-weight: 700; }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-box {
      background: #fff;
      border-radius: 8px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .modal-header {
      padding: 1rem 1.25rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #64748b;
    }

    .modal-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .modal-footer {
      padding: 0.75rem 1.25rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .csv-hint {
      font-size: 0.75rem;
      color: #64748b;
      background: #f1f5f9;
      padding: 0.5rem;
      border-radius: 4px;
    }

    .fee-summary {
      background: #fef3c7;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.8125rem;
      color: #78350f;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  `]
})
export class ReconciliationComponent implements OnInit {
  private bankingService = inject(BankingService);
  private notificationService = inject(NotificationService);

  Math = Math;

  bankAccounts = signal<BankAccount[]>([]);
  selectedAccountId = signal<number | null>(null);
  statementDate = signal<string>(new Date().toISOString().split('T')[0]);
  statementBalance = signal<number | null>(null);

  currentReconciliation = signal<BankReconciliation | null>(null);
  loading = signal<boolean>(false);

  // Manual matching state
  selectedStmtLineId = signal<number | null>(null);
  selectedBookLineId = signal<number | null>(null);

  // Upload modal state
  showUploadModal = signal<boolean>(false);
  uploadAccountId = signal<number | null>(null);
  uploadDate = signal<string>('');
  selectedFile = signal<File | null>(null);

  // Quick Charge modal state
  showChargeModal = signal<boolean>(false);
  activeChargeLine = signal<BankStatementLine | null>(null);
  chargeDescription = signal<string>('');

  isBalanced = computed<boolean>(() => {
    const recon = this.currentReconciliation();
    if (!recon) return false;
    return Math.abs(recon.difference) < 0.001;
  });

  canComplete = computed<boolean>(() => {
    const recon = this.currentReconciliation();
    return !!recon && recon.status === 'IN_PROGRESS' && this.isBalanced();
  });

  ngOnInit(): void {
    this.loadBankAccounts();
  }

  loadBankAccounts(): void {
    this.bankingService.getBankAccounts().subscribe({
      next: (accounts) => {
        this.bankAccounts.set(accounts);
        if (accounts.length > 0 && !this.selectedAccountId()) {
          this.selectedAccountId.set(accounts[0].id);
          this.uploadAccountId.set(accounts[0].id);
          this.checkExistingReconciliations();
        }
      },
      error: (err) => this.notificationService.error('Failed to load bank accounts')
    });
  }

  onAccountChange(): void {
    this.uploadAccountId.set(this.selectedAccountId());
    this.checkExistingReconciliations();
  }

  checkExistingReconciliations(): void {
    const accountId = this.selectedAccountId();
    if (!accountId) return;
    this.bankingService.getReconciliationsByAccount(accountId).subscribe({
      next: (recons) => {
        if (recons.length > 0) {
          const latest = recons[0];
          this.currentReconciliation.set(latest);
          this.statementDate.set(latest.statementDate);
          this.statementBalance.set(latest.statementBalance);
        } else {
          this.currentReconciliation.set(null);
        }
      }
    });
  }

  startOrLoadReconciliation(): void {
    const accountId = this.selectedAccountId();
    const stmtDate = this.statementDate();
    if (!accountId || !stmtDate) return;
    this.loading.set(true);
    const req: StartReconciliationRequest = {
      bankAccountId: accountId,
      statementDate: stmtDate,
      statementBalance: this.statementBalance() ?? 0
    };

    this.bankingService.startReconciliation(req).subscribe({
      next: (recon) => {
        this.currentReconciliation.set(recon);
        this.loading.set(false);
        this.clearSelection();
        this.notificationService.success('Reconciliation loaded successfully');
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Failed to start reconciliation');
      }
    });
  }

  selectStmtLine(id: number): void {
    this.selectedStmtLineId.set(this.selectedStmtLineId() === id ? null : id);
  }

  selectBookLine(id: number): void {
    this.selectedBookLineId.set(this.selectedBookLineId() === id ? null : id);
  }

  getSelectedStmtLine(): BankStatementLine | undefined {
    const stmtId = this.selectedStmtLineId();
    return this.currentReconciliation()?.statementLines.find(l => l.id === stmtId);
  }

  getSelectedBookLine(): BookTransaction | undefined {
    const bookId = this.selectedBookLineId();
    return this.currentReconciliation()?.bookTransactions.find(b => b.journalLineId === bookId);
  }

  clearSelection(): void {
    this.selectedStmtLineId.set(null);
    this.selectedBookLineId.set(null);
  }

  handleManualMatch(): void {
    const recon = this.currentReconciliation();
    const stmtId = this.selectedStmtLineId();
    const bookId = this.selectedBookLineId();
    if (!recon || !stmtId || !bookId) return;
    this.loading.set(true);

    this.bankingService.match(recon.id, {
      statementLineId: stmtId,
      journalLineId: bookId
    }).subscribe({
      next: (updated) => {
        this.currentReconciliation.set(updated);
        this.clearSelection();
        this.loading.set(false);
        this.notificationService.success('Matched statement line with journal entry');
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Match failed');
      }
    });
  }

  handleUnmatch(statementLineId: number): void {
    const recon = this.currentReconciliation();
    if (!recon) return;
    this.loading.set(true);

    this.bankingService.unmatch(recon.id, statementLineId).subscribe({
      next: (updated) => {
        this.currentReconciliation.set(updated);
        this.clearSelection();
        this.loading.set(false);
        this.notificationService.success('Unmatched statement line');
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Unmatch failed');
      }
    });
  }

  handleAutoMatch(): void {
    const recon = this.currentReconciliation();
    if (!recon) return;
    this.loading.set(true);

    this.bankingService.autoMatch(recon.id).subscribe({
      next: (result) => {
        this.notificationService.success(`Auto-match completed! Matched ${result.matchedCount} line(s) totaling ${result.reconciledTotal.toFixed(2)}.`);
        this.refreshReconciliation();
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Auto-match failed');
      }
    });
  }

  refreshReconciliation(): void {
    const recon = this.currentReconciliation();
    if (!recon) return;
    this.bankingService.getReconciliation(recon.id).subscribe({
      next: (updatedRecon) => {
        this.currentReconciliation.set(updatedRecon);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openBankChargeModal(line: BankStatementLine): void {
    this.activeChargeLine.set(line);
    this.chargeDescription.set(line.description || 'Bank Charge');
    this.showChargeModal.set(true);
  }

  closeChargeModal(): void {
    this.showChargeModal.set(false);
    this.activeChargeLine.set(null);
  }

  submitBankCharge(): void {
    const recon = this.currentReconciliation();
    const chargeLine = this.activeChargeLine();
    if (!recon || !chargeLine) return;
    this.loading.set(true);

    this.bankingService.createBankCharge(recon.id, {
      statementLineId: chargeLine.id,
      description: this.chargeDescription()
    }).subscribe({
      next: (updated) => {
        this.currentReconciliation.set(updated);
        this.closeChargeModal();
        this.loading.set(false);
        this.notificationService.success('Bank charge recorded and matched successfully');
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Failed to record bank charge');
      }
    });
  }

  handleComplete(): void {
    const recon = this.currentReconciliation();
    if (!recon) return;
    if (!this.isBalanced()) {
      this.notificationService.error('Reconciliation difference must strictly equal 0.00 to complete');
      return;
    }

    this.loading.set(true);
    this.bankingService.completeReconciliation(recon.id).subscribe({
      next: (completed) => {
        this.currentReconciliation.set(completed);
        this.loading.set(false);
        this.notificationService.success('Bank reconciliation completed and cleared!');
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Failed to complete reconciliation');
      }
    });
  }

  // Statement CSV file upload handling
  openUploadModal(): void {
    this.uploadAccountId.set(this.selectedAccountId());
    this.uploadDate.set(this.statementDate());
    this.selectedFile.set(null);
    this.showUploadModal.set(true);
  }

  closeUploadModal(): void {
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  handleUploadStatement(): void {
    const file = this.selectedFile();
    const accountId = this.uploadAccountId();
    if (!file || !accountId) return;
    this.loading.set(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankAccountId', accountId.toString());
    const date = this.uploadDate();
    if (date) {
      formData.append('statementDate', date);
    }
    const bal = this.statementBalance();
    if (bal !== null) {
      formData.append('closingBalance', bal.toString());
    }

    this.bankingService.importStatement(formData).subscribe({
      next: (stmt) => {
        this.notificationService.success(`Imported statement with ${stmt.lines?.length || 0} transaction lines!`);
        this.closeUploadModal();
        this.loading.set(false);
        this.startOrLoadReconciliation();
      },
      error: (err) => {
        this.loading.set(false);
        this.notificationService.error(err.error?.message || 'Failed to import CSV statement');
      }
    });
  }
}

