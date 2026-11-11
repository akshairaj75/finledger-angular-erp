import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { Account, AccountType, NormalBalance } from '../../../core/models/account.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../services/settings.service';

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
        <button *appHasPermission="['ACCOUNT_CREATE', 'ACCOUNT_EDIT']" class="btn-primary" (click)="openNew()">
          + New Account
        </button>
      </div>

      <div class="card">
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
                <span [style.padding-left.px]="a.parentId ? 18 : 0">
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
              <label><input type="checkbox" formControlName="isGroup" /> Header Group Account (Non-postable)</label>
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
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; font-size: 1.45rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f8fafc; padding: 0.8rem 1rem; text-align: left; font-size: 0.78rem; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; }
    .group-row { background: #f8fafc; font-weight: 600; }
    .mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .text-right { text-align: right; }
    .type-pill { background: #eff6ff; color: #1d4ed8; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; }
    .badge { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; background: #fee2e2; color: #991b1b; }
    .badge.active { background: #dcfce7; color: #166534; }
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.6rem 1.15rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }
    .btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-card { background: #fff; border-radius: 12px; width: 100%; max-width: 520px; }
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
  `]
})
export class ChartOfAccountsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  accounts = signal<Account[]>([]);
  showModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  editing = signal<Account | null>(null);

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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.settingsService.getAccounts().subscribe(res => this.accounts.set(res.content || []));
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

