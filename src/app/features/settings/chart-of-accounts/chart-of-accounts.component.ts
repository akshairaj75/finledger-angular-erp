import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, concatMap, from, of, tap } from 'rxjs';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { Account, AccountType, NormalBalance } from '../../../core/models/account.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../services/settings.service';

export interface ParsedAccountRow {
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  subType?: string;
  isValid: boolean;
  errorMessage?: string;
  importStatus?: 'PENDING' | 'SUCCESS' | 'ERROR';
}

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective],
  template: `
    <div class="coa-page">
      <div class="page-header">
        <div>
          <h2>Chart of Accounts</h2>
          <p class="subtitle">Manage postable ledger accounts, parent groups, and normal balances</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-outline" (click)="exportCsv()" [disabled]="accounts().length === 0">
            📊 Export CSV
          </button>
          <button
            *appHasPermission="['ACCOUNT_CREATE', 'ACCOUNT_EDIT']"
            type="button"
            class="btn-outline"
            (click)="openImportModal()"
          >
            📥 Import Accounts
          </button>
          <button *appHasPermission="['ACCOUNT_CREATE', 'ACCOUNT_EDIT']" class="btn-primary" (click)="openNew()">
            + New Account
          </button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Normal Balance</th>
                <th>Classification</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of accounts()" [class.group-row]="a.isGroup">
                <td class="mono font-bold">{{ a.code }}</td>
                <td>
                  <span [style.padding-inline-start.px]="a.parentId ? 18 : 0">
                    {{ a.isGroup ? '📁 ' : '' }}{{ a.name }}
                  </span>
                </td>
                <td><span class="type-pill">{{ a.accountType }}</span></td>
                <td>{{ a.normalBalance }}</td>
                <td>{{ a.isGroup ? 'Header Group' : (a.subType || 'Transactional') }}</td>
                <td>
                  <span class="badge" [class.active]="a.isActive">{{ a.isActive ? 'Active' : 'Inactive' }}</span>
                </td>
                <td class="text-right">
                  <button
                    *appHasPermission="'ACCOUNT_EDIT'"
                    class="btn-sm btn-outline"
                    (click)="openEdit(a)"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create / Edit Modal -->
      <div class="modal-backdrop" *ngIf="showModal()">
        <div class="modal-card">
          <div class="modal-header">
            <h3>{{ editing() ? 'Edit Account: ' + editing()!.code : 'New Ledger Account' }}</h3>
            <button class="close-btn" (click)="showModal.set(false)">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()" class="modal-body">
            <div class="row-2">
              <div class="form-group">
                <label>Code *</label>
                <input type="text" formControlName="code" placeholder="e.g. 5250" />
              </div>
              <div class="form-group">
                <label>Account Type *</label>
                <select formControlName="accountType">
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Account Name *</label>
              <input type="text" formControlName="name" placeholder="Marketing & Advertising" />
            </div>

            <div class="row-2">
              <div class="form-group">
                <label>Normal Balance *</label>
                <select formControlName="normalBalance">
                  <option value="DEBIT">DEBIT</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>
              <div class="form-group">
                <label>Sub-Type Tag</label>
                <input type="text" formControlName="subType" placeholder="BANK, CASH, EXPENSE, TAX..." />
              </div>
            </div>

            <div class="form-group">
              <label>Parent Group</label>
              <select formControlName="parentId">
                <option [ngValue]="null">None (Root Level)</option>
                <option *ngFor="let g of groupAccounts()" [ngValue]="g.id">{{ g.code }} - {{ g.name }}</option>
              </select>
            </div>

            <div class="checks-row">
              <label><input type="checkbox" formControlName="isGroup" /> Is Header Group</label>
              <label><input type="checkbox" formControlName="isActive" /> Active</label>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-outline" (click)="showModal.set(false)">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving...' : 'Save Account' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- CSV Import Modal -->
      <div class="modal-backdrop" *ngIf="showImportModal()">
        <div class="modal-card modal-wide">
          <div class="modal-header">
            <h3>Import Chart of Accounts (CSV)</h3>
            <button class="close-btn" (click)="showImportModal.set(false)">&times;</button>
          </div>
          <div class="modal-body">
            <p class="import-help">
              Upload a standard CSV file with columns: <code>Code, Name, AccountType, NormalBalance, SubType</code>.
              Allowed types: <strong>ASSET, LIABILITY, EQUITY, INCOME, EXPENSE</strong>.
            </p>

            <div class="file-picker-row">
              <input type="file" accept=".csv,text/csv" (change)="onFileSelected($event)" />
            </div>

            <div *ngIf="importSummary()" class="alert-box alert-info mt-2">
              {{ importSummary() }}
            </div>

            <!-- Preview Table -->
            <div class="preview-scroll" *ngIf="parsedRows().length > 0">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th>Balance</th>
                    <th>Validation Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of parsedRows()">
                    <td>
                      <span *ngIf="r.importStatus === 'SUCCESS'" class="badge active">Imported</span>
                      <span *ngIf="r.importStatus === 'ERROR'" class="badge">Failed</span>
                      <span *ngIf="!r.importStatus && r.isValid" class="badge active">Valid</span>
                      <span *ngIf="!r.importStatus && !r.isValid" class="badge">Invalid</span>
                    </td>
                    <td class="mono font-bold">{{ r.code }}</td>
                    <td>{{ r.name }}</td>
                    <td>{{ r.accountType }}</td>
                    <td>{{ r.normalBalance }}</td>
                    <td [class.text-danger]="!r.isValid" [class.text-muted]="r.isValid">
                      {{ r.errorMessage || 'Ready for import' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-outline" (click)="showImportModal.set(false)">Close</button>
              <button
                type="button"
                class="btn-primary"
                (click)="runImport()"
                [disabled]="importing() || validRowCount() === 0"
              >
                {{ importing() ? 'Importing Accounts...' : 'Import ' + validRowCount() + ' Valid Accounts' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .coa-page { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .page-header h2 { margin: 0; font-size: 1.5rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.85rem; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f8fafc; padding: 0.8rem 1rem; text-align: start; font-size: 0.78rem; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; text-align: start; }
    .group-row { background: #f8fafc; font-weight: 600; }
    .mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .text-right { text-align: end; }
    .text-danger { color: #dc2626; font-size: 0.8rem; }
    .text-muted { color: #64748b; font-size: 0.8rem; }
    .type-pill { background: #eff6ff; color: #1d4ed8; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; }
    .badge { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; background: #fee2e2; color: #991b1b; }
    .badge.active { background: #dcfce7; color: #166534; }
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.6rem 1.15rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }
    .btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 500; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-card { background: #fff; border-radius: 12px; width: 100%; max-width: 520px; }
    .modal-wide { max-width: 760px; }
    .modal-header { padding: 1rem 1.35rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .modal-body { padding: 1.35rem; display: flex; flex-direction: column; gap: 1rem; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input, .form-group select { padding: 0.55rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .checks-row { display: flex; gap: 1.25rem; font-size: 0.85rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
    .import-help { font-size: 0.85rem; color: #475569; margin: 0; }
    .import-help code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 4px; }
    .preview-scroll { max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }

    @media (max-width: 767px) {
      .coa-page { padding: 0.75rem; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .header-actions { width: 100%; flex-wrap: wrap; }
      .header-actions .btn-primary, .header-actions .btn-outline { flex: 1; justify-content: center; text-align: center; }
      .modal-card { width: 95vw; max-width: 95vw; margin: 0.5rem auto; }
      .row-2 { grid-template-columns: 1fr; }
      .data-table { min-width: 600px; }
      .card { overflow-x: auto; }
    }
  `]
})
export class ChartOfAccountsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  accounts = signal<Account[]>([]);
  showModal = signal<boolean>(false);
  showImportModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  importing = signal<boolean>(false);
  editing = signal<Account | null>(null);

  parsedRows = signal<ParsedAccountRow[]>([]);
  importSummary = signal<string | null>(null);

  form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    accountType: ['EXPENSE' as AccountType, Validators.required],
    normalBalance: ['DEBIT' as NormalBalance, Validators.required],
    subType: [''],
    parentId: [null as number | null],
    isGroup: [false],
    isActive: [true]
  });

  groupAccounts = computed<Account[]>(() => this.accounts().filter(a => a.isGroup));
  validRowCount = computed(() => this.parsedRows().filter(r => r.isValid && r.importStatus !== 'SUCCESS').length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.settingsService.getAccounts().subscribe(res => this.accounts.set(res.content || []));
  }

  exportCsv(): void {
    const headers = ['Code', 'Name', 'AccountType', 'NormalBalance', 'Classification', 'Status'];
    const rows = this.accounts().map(a => [
      `"${a.code}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.accountType}"`,
      `"${a.normalBalance}"`,
      `"${a.isGroup ? 'Header Group' : (a.subType || 'Transactional')}"`,
      `"${a.isActive ? 'Active' : 'Inactive'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chart_of_accounts_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.notification.success('Chart of Accounts exported successfully.');
  }

  openImportModal(): void {
    this.parsedRows.set([]);
    this.importSummary.set(null);
    this.showImportModal.set(true);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      this.parseCsvContent(text);
    };

    reader.readAsText(file);
  }

  parseCsvContent(csv: string): void {
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      this.notification.error('CSV file is empty or missing headers.');
      return;
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.replace(/["']/g, '').trim());
    const codeIdx = header.findIndex(h => h.includes('code'));
    const nameIdx = header.findIndex(h => h.includes('name'));
    const typeIdx = header.findIndex(h => h.includes('type'));
    const balIdx = header.findIndex(h => h.includes('balance'));
    const subTypeIdx = header.findIndex(h => h.includes('subtype') || h.includes('class'));

    if (codeIdx === -1 || nameIdx === -1) {
      this.notification.error('CSV header must contain "Code" and "Name" columns.');
      return;
    }

    const validTypes: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    const validBalances: NormalBalance[] = ['DEBIT', 'CREDIT'];
    const parsed: ParsedAccountRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawCols = this.parseCsvLine(lines[i]);
      const code = (rawCols[codeIdx] || '').trim();
      const name = (rawCols[nameIdx] || '').trim();
      const rawType = (rawCols[typeIdx] || 'EXPENSE').trim().toUpperCase() as AccountType;
      const rawBal = (rawCols[balIdx] || (rawType === 'ASSET' || rawType === 'EXPENSE' ? 'DEBIT' : 'CREDIT')).trim().toUpperCase() as NormalBalance;
      const subType = subTypeIdx !== -1 ? (rawCols[subTypeIdx] || '').trim() : undefined;

      let isValid = true;
      let errorMessage = '';

      if (!code) {
        isValid = false;
        errorMessage = 'Missing account code';
      } else if (!name) {
        isValid = false;
        errorMessage = 'Missing account name';
      } else if (!validTypes.includes(rawType)) {
        isValid = false;
        errorMessage = `Invalid AccountType "${rawType}"`;
      } else if (!validBalances.includes(rawBal)) {
        isValid = false;
        errorMessage = `Invalid NormalBalance "${rawBal}"`;
      }

      parsed.push({
        code,
        name,
        accountType: rawType,
        normalBalance: rawBal,
        subType: subType || undefined,
        isValid,
        errorMessage: errorMessage || undefined,
        importStatus: 'PENDING'
      });
    }

    this.parsedRows.set(parsed);
    const validCount = parsed.filter(p => p.isValid).length;
    this.importSummary.set(`Found ${parsed.length} rows (${validCount} valid, ${parsed.length - validCount} invalid).`);
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.replace(/^"|"$/g, ''));
    return result;
  }

  runImport(): void {
    const validRows = this.parsedRows().filter(r => r.isValid && r.importStatus !== 'SUCCESS');
    if (validRows.length === 0) return;

    this.importing.set(true);
    let successes = 0;
    let failures = 0;

    from(validRows)
      .pipe(
        concatMap(row =>
          this.settingsService
            .createAccount({
              code: row.code,
              name: row.name,
              accountType: row.accountType,
              normalBalance: row.normalBalance,
              subType: row.subType,
              isActive: true,
              isGroup: false
            })
            .pipe(
              tap(() => {
                row.importStatus = 'SUCCESS';
                successes++;
              }),
              catchError(err => {
                row.importStatus = 'ERROR';
                row.errorMessage = err?.error?.message || 'Creation failed';
                failures++;
                return of(null);
              })
            )
        )
      )
      .subscribe({
        complete: () => {
          this.finishImport(successes, failures);
        }
      });
  }

  private finishImport(successes: number, failures: number): void {
    this.importing.set(false);
    this.load();
    if (failures === 0) {
      this.notification.success(`Successfully imported ${successes} accounts!`);
      this.showImportModal.set(false);
    } else {
      this.notification.warning(`Imported ${successes} accounts with ${failures} errors.`);
    }
  }

  openNew(): void {
    this.editing.set(null);
    this.form.reset({
      code: '',
      name: '',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      subType: '',
      parentId: null,
      isGroup: false,
      isActive: true
    });
    this.showModal.set(true);
  }

  openEdit(acc: Account): void {
    this.editing.set(acc);
    this.form.patchValue({
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      normalBalance: acc.normalBalance,
      subType: acc.subType || '',
      parentId: acc.parentId ?? null,
      isGroup: acc.isGroup,
      isActive: acc.isActive
    });
    this.showModal.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      code: raw.code!,
      name: raw.name!,
      accountType: raw.accountType!,
      normalBalance: raw.normalBalance!,
      subType: raw.subType || undefined,
      parentId: raw.parentId ?? undefined,
      isGroup: !!raw.isGroup,
      isActive: raw.isActive !== false
    };

    const editingAcc = this.editing();
    const obs = editingAcc
      ? this.settingsService.updateAccount(editingAcc.id, payload)
      : this.settingsService.createAccount(payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.notification.success('Account saved');
        this.load();
      },
      error: () => this.saving.set(false)
    });
  }
}
