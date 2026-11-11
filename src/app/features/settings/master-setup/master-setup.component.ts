import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account } from '../../../core/models/account.model';
import { AccountKind, BankAccount } from '../../../core/models/bank-account.model';
import { ExpenseCategory } from '../../../core/models/expense.model';
import { Warehouse } from '../../../core/models/inventory.model';
import { TaxRate, TaxType } from '../../../core/models/tax-rate.model';
import { NotificationService } from '../../../core/services/notification.service';
import {
  AuditLogItem,
  CrmStageItem,
  CurrencyItem,
  ExchangeRateItem,
  NumberSeriesItem
} from '../models/settings.model';
import { SettingsService } from '../services/settings.service';

type SetupTab = 'banks' | 'taxes' | 'currencies' | 'categories' | 'warehouses' | 'stages' | 'series' | 'audit';

@Component({
  selector: 'app-master-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="setup-page">
      <div class="page-header">
        <div>
          <h2>Master Data &amp; Operational Setup</h2>
          <p class="subtitle">
            Configure Bank Accounts, Tax Rates, FX, Expense Policies, Warehouses, CRM Stages, Number Series &amp; Audit Trail
          </p>
        </div>
      </div>

      <div class="tabs-bar">
        <button [class.active]="tab === 'banks'" (click)="tab = 'banks'">🏦 Bank Accounts</button>
        <button [class.active]="tab === 'taxes'" (click)="tab = 'taxes'">📑 Tax Rates</button>
        <button [class.active]="tab === 'currencies'" (click)="tab = 'currencies'">💱 Currencies &amp; FX</button>
        <button [class.active]="tab === 'categories'" (click)="tab = 'categories'">🧾 Expense Categories</button>
        <button [class.active]="tab === 'warehouses'" (click)="tab = 'warehouses'">🏭 Warehouses</button>
        <button [class.active]="tab === 'stages'" (click)="tab = 'stages'">🎯 CRM Stages</button>
        <button [class.active]="tab === 'series'" (click)="tab = 'series'">🔢 Number Series</button>
        <button [class.active]="tab === 'audit'" (click)="tab = 'audit'; loadAuditLogs()">📜 Audit Log</button>
      </div>

      <!-- TAB 1: BANK ACCOUNTS -->
      <div class="tab-panel" *ngIf="tab === 'banks'">
        <div class="panel-grid">
          <div class="card">
            <h3>Active Bank &amp; Cash Accounts</h3>
            <table class="data-table">
              <thead><tr><th>Name</th><th>Bank</th><th>Currency</th><th>Kind</th><th>GL Account</th></tr></thead>
              <tbody>
                <tr *ngFor="let b of bankAccounts">
                  <td class="font-medium">{{ b.name }}</td>
                  <td>{{ b.bankName || '-' }}</td>
                  <td>{{ b.currencyCode }}</td>
                  <td>{{ b.accountKind }}</td>
                  <td>{{ getAccountLabel(b.glAccountId) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Add Bank Account</h3>
            <form [formGroup]="bankForm" (ngSubmit)="saveBank()" class="stack-form">
              <label>Account Name * <input type="text" formControlName="name" placeholder="ADCB Business Checking" /></label>
              <label>Bank Name <input type="text" formControlName="bankName" placeholder="ADCB" /></label>
              <label>IBAN <input type="text" formControlName="iban" placeholder="AE..." /></label>
              <label>Currency * <input type="text" formControlName="currencyCode" maxlength="3" /></label>
              <label>Account Kind *
                <select formControlName="accountKind">
                  <option value="BANK">BANK</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                </select>
              </label>
              <label>Linked GL Account *
                <select formControlName="glAccountId">
                  <option *ngFor="let a of assetAccounts" [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option>
                </select>
              </label>
              <button type="submit" class="btn-primary" [disabled]="bankForm.invalid">Add Bank Account</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 2: TAX RATES -->
      <div class="tab-panel" *ngIf="tab === 'taxes'">
        <div class="panel-grid">
          <div class="card">
            <h3>Configured Tax Rates</h3>
            <table class="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Rate (%)</th></tr></thead>
              <tbody>
                <tr *ngFor="let t of taxRates">
                  <td class="font-medium">{{ t.code }}</td>
                  <td>{{ t.name }}</td>
                  <td>{{ t.taxType }}</td>
                  <td>{{ t.rate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Add Tax Rate</h3>
            <form [formGroup]="taxForm" (ngSubmit)="saveTax()" class="stack-form">
              <label>Tax Code * <input type="text" formControlName="code" placeholder="VAT5-NEW" /></label>
              <label>Name * <input type="text" formControlName="name" placeholder="Standard 5%" /></label>
              <label>Type *
                <select formControlName="taxType">
                  <option value="STANDARD">STANDARD</option>
                  <option value="ZERO">ZERO</option>
                  <option value="EXEMPT">EXEMPT</option>
                  <option value="OUT_OF_SCOPE">OUT_OF_SCOPE</option>
                </select>
              </label>
              <label>Rate % * <input type="number" step="0.01" formControlName="rate" /></label>
              <button type="submit" class="btn-primary" [disabled]="taxForm.invalid">Save Tax Rate</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 3: CURRENCIES & FX -->
      <div class="tab-panel" *ngIf="tab === 'currencies'">
        <div class="panel-grid">
          <div class="card">
            <h3>Exchange Rates</h3>
            <table class="data-table">
              <thead><tr><th>Pair</th><th>Effective Date</th><th>Rate</th></tr></thead>
              <tbody>
                <tr *ngFor="let fx of exchangeRates">
                  <td class="font-medium">{{ fx.fromCurrency }} → {{ fx.toCurrency }}</td>
                  <td>{{ fx.rateDate }}</td>
                  <td>{{ fx.rate }}</td>
                </tr>
                <tr *ngIf="!exchangeRates.length"><td colspan="3" class="text-muted">No custom exchange rates recorded yet.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Record Exchange Rate</h3>
            <form [formGroup]="fxForm" (ngSubmit)="saveFx()" class="stack-form">
              <label>From Currency *
                <select formControlName="fromCurrency">
                  <option *ngFor="let c of currencies" [value]="c.code">{{ c.code }} - {{ c.name }}</option>
                </select>
              </label>
              <label>To Currency *
                <select formControlName="toCurrency">
                  <option *ngFor="let c of currencies" [value]="c.code">{{ c.code }} - {{ c.name }}</option>
                </select>
              </label>
              <label>Effective Date * <input type="date" formControlName="rateDate" /></label>
              <label>Rate * <input type="number" step="0.0001" formControlName="rate" /></label>
              <button type="submit" class="btn-primary" [disabled]="fxForm.invalid">Set Rate</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 4: EXPENSE CATEGORIES -->
      <div class="tab-panel" *ngIf="tab === 'categories'">
        <div class="panel-grid">
          <div class="card">
            <h3>Expense Policy Categories</h3>
            <table class="data-table">
              <thead><tr><th>Name</th><th>GL Account</th><th>Limit / Claim</th><th>Receipt Required</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of categories">
                  <td class="font-medium">{{ c.name }}</td>
                  <td>{{ getAccountLabel(c.accountId) }}</td>
                  <td>{{ c.limitPerClaim ? (c.limitPerClaim | number:'1.2-2') : 'No Limit' }}</td>
                  <td>{{ c.receiptRequired ? 'Yes' : 'Optional' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Add Expense Category</h3>
            <form [formGroup]="catForm" (ngSubmit)="saveCategory()" class="stack-form">
              <label>Category Name * <input type="text" formControlName="name" placeholder="Client Gifts" /></label>
              <label>Expense GL Account *
                <select formControlName="accountId">
                  <option *ngFor="let a of expenseAccounts" [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option>
                </select>
              </label>
              <label>Per-Claim Limit (Optional) <input type="number" formControlName="limitPerClaim" /></label>
              <label class="inline-check"><input type="checkbox" formControlName="receiptRequired" /> Require Receipt Upload</label>
              <button type="submit" class="btn-primary" [disabled]="catForm.invalid">Add Category</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 5: WAREHOUSES -->
      <div class="tab-panel" *ngIf="tab === 'warehouses'">
        <div class="panel-grid">
          <div class="card">
            <h3>Configured Warehouses</h3>
            <table class="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Address</th><th>Default</th></tr></thead>
              <tbody>
                <tr *ngFor="let w of warehouses">
                  <td class="font-medium">{{ w.code }}</td>
                  <td>{{ w.name }}</td>
                  <td>{{ w.address || '-' }}</td>
                  <td>{{ w.isDefault ? '⭐ Default' : 'No' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Add Warehouse</h3>
            <form [formGroup]="whForm" (ngSubmit)="saveWarehouse()" class="stack-form">
              <label>Warehouse Code * <input type="text" formControlName="code" placeholder="WH-SHJ" /></label>
              <label>Warehouse Name * <input type="text" formControlName="name" placeholder="Sharjah Distribution Center" /></label>
              <label>Address <input type="text" formControlName="address" /></label>
              <label class="inline-check"><input type="checkbox" formControlName="isDefault" /> Mark as Default Warehouse</label>
              <button type="submit" class="btn-primary" [disabled]="whForm.invalid">Create Warehouse</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 6: CRM PIPELINE STAGES (Section 4.16) -->
      <div class="tab-panel" *ngIf="tab === 'stages'">
        <div class="panel-grid">
          <div class="card">
            <h3>Sales Pipeline Stages</h3>
            <table class="data-table">
              <thead><tr><th>Order</th><th>Stage Name</th><th>Win Probability</th><th>Stage Type</th></tr></thead>
              <tbody>
                <tr *ngFor="let s of crmStages">
                  <td>{{ s.sortOrder }}</td>
                  <td class="font-medium">{{ s.name }}</td>
                  <td>{{ s.probabilityPct }}%</td>
                  <td><span class="pill" [ngClass]="'pill-' + s.stageType">{{ s.stageType }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>Add Pipeline Stage</h3>
            <form [formGroup]="stageForm" (ngSubmit)="saveStage()" class="stack-form">
              <label>Stage Name * <input type="text" formControlName="name" placeholder="Technical Review" /></label>
              <label>Sort Order * <input type="number" formControlName="sortOrder" min="1" /></label>
              <label>Win Probability (%) * <input type="number" formControlName="probabilityPct" min="0" max="100" /></label>
              <label>Stage Type *
                <select formControlName="stageType">
                  <option value="OPEN">OPEN</option>
                  <option value="WON">WON</option>
                  <option value="LOST">LOST</option>
                </select>
              </label>
              <button type="submit" class="btn-primary" [disabled]="stageForm.invalid">Create Stage</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 7: NUMBER SERIES (Section 4.16) -->
      <div class="tab-panel" *ngIf="tab === 'series'">
        <div class="card">
          <h3>Document Number Series</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Prefix</th>
                <th>Next Sequence</th>
                <th>Zero Padding</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ns of numberSeries">
                <td class="font-medium">{{ ns.docType }}</td>
                <td><input type="text" [(ngModel)]="ns.prefix" class="inline-input" /></td>
                <td><input type="number" [(ngModel)]="ns.nextNumber" min="1" class="inline-input short" /></td>
                <td><input type="number" [(ngModel)]="ns.padding" min="1" max="8" class="inline-input short" /></td>
                <td class="text-right">
                  <button type="button" class="btn-sm" (click)="saveSeries(ns)">Save</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 8: AUDIT LOGS (Section 4.16 / 6.2) -->
      <div class="tab-panel" *ngIf="tab === 'audit'">
        <div class="card">
          <div class="audit-toolbar">
            <h3>Immutable System Audit Trail</h3>
            <div class="audit-filters">
              <input type="text" [(ngModel)]="auditEntityFilter" placeholder="Filter by entity (Invoice, JournalEntry...)" class="inline-input" />
              <input type="date" [(ngModel)]="auditFrom" class="inline-input" />
              <input type="date" [(ngModel)]="auditTo" class="inline-input" />
              <button type="button" class="btn-sm" (click)="loadAuditLogs(0)">Filter</button>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Record ID</th>
                <th>Change Details</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of auditLogs">
                <td>{{ log.createdAt | date:'short' }}</td>
                <td class="font-medium">{{ log.userName }}</td>
                <td><span class="pill pill-OPEN">{{ log.action }}</span></td>
                <td>{{ log.entityName }}</td>
                <td>#{{ log.entityId }}</td>
                <td class="audit-json">{{ log.newValues || log.oldValues || '-' }}</td>
              </tr>
              <tr *ngIf="!auditLogs.length">
                <td colspan="6" class="text-muted">No audit entries matching the selected filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 1.25rem; }
    .page-header h2 { margin: 0; font-size: 1.45rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
    .tabs-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
    .tabs-bar button {
      background: #fff;
      border: 1px solid #cbd5e1;
      padding: 0.5rem 0.9rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.82rem;
      color: #475569;
      cursor: pointer;
    }
    .tabs-bar button.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    .panel-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: start; }
    @media (max-width: 960px) { .panel-grid { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; }
    .card h3 { margin: 0 0 1rem; font-size: 1.05rem; color: #0f172a; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; padding: 0.6rem; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 0.65rem 0.6rem; font-size: 0.86rem; border-bottom: 1px solid #f1f5f9; }
    .font-medium { font-weight: 600; }
    .text-right { text-align: right; }
    .text-muted { color: #94a3b8; text-align: center; }
    .stack-form { display: flex; flex-direction: column; gap: 0.85rem; }
    .stack-form label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: #334155; }
    .stack-form input, .stack-form select { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .stack-form label.inline-check { flex-direction: row; align-items: center; gap: 0.5rem; }
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-sm { background: #2563eb; color: #fff; border: none; padding: 0.35rem 0.85rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; }
    .inline-input { padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.84rem; }
    .inline-input.short { width: 85px; }
    .pill { padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
    .pill-OPEN { background: #eff6ff; color: #1d4ed8; }
    .pill-WON { background: #dcfce7; color: #166534; }
    .pill-LOST { background: #fee2e2; color: #991b1b; }
    .audit-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
    .audit-toolbar h3 { margin: 0; }
    .audit-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .audit-json { max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; font-size: 0.75rem; color: #475569; }
  `]
})
export class MasterSetupComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  tab: SetupTab = 'banks';
  accounts: Account[] = [];
  bankAccounts: BankAccount[] = [];
  taxRates: TaxRate[] = [];
  currencies: CurrencyItem[] = [];
  exchangeRates: ExchangeRateItem[] = [];
  categories: ExpenseCategory[] = [];
  warehouses: Warehouse[] = [];
  crmStages: CrmStageItem[] = [];
  numberSeries: NumberSeriesItem[] = [];
  auditLogs: AuditLogItem[] = [];

  auditEntityFilter = '';
  auditFrom = '';
  auditTo = '';

  bankForm = this.fb.group({
    name: ['', Validators.required],
    bankName: [''],
    iban: [''],
    currencyCode: ['AED', Validators.required],
    accountKind: ['BANK' as AccountKind, Validators.required],
    glAccountId: [null as number | null, Validators.required]
  });

  taxForm = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    taxType: ['STANDARD' as TaxType, Validators.required],
    rate: [5, Validators.required]
  });

  fxForm = this.fb.group({
    fromCurrency: ['USD', Validators.required],
    toCurrency: ['AED', Validators.required],
    rateDate: [new Date().toISOString().substring(0, 10), Validators.required],
    rate: [3.6725, Validators.required]
  });

  catForm = this.fb.group({
    name: ['', Validators.required],
    accountId: [null as number | null, Validators.required],
    limitPerClaim: [null as number | null],
    receiptRequired: [true]
  });

  whForm = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    address: [''],
    isDefault: [false]
  });

  stageForm = this.fb.group({
    name: ['', Validators.required],
    sortOrder: [10, Validators.required],
    probabilityPct: [50, Validators.required],
    stageType: ['OPEN' as 'OPEN' | 'WON' | 'LOST', Validators.required]
  });

  get assetAccounts(): Account[] {
    return this.accounts.filter(a => !a.isGroup && a.accountType === 'ASSET');
  }

  get expenseAccounts(): Account[] {
    return this.accounts.filter(a => !a.isGroup && a.accountType === 'EXPENSE');
  }

  ngOnInit(): void {
    this.settingsService.getAccounts().subscribe(res => (this.accounts = res.content || []));
    this.loadBanks();
    this.loadTaxes();
    this.loadCurrencies();
    this.loadCategories();
    this.loadWarehouses();
    this.loadStages();
    this.loadNumberSeries();
  }

  getAccountLabel(id?: number): string {
    if (!id) return '-';
    const acc = this.accounts.find(a => a.id === id);
    return acc ? `${acc.code} - ${acc.name}` : `#${id}`;
  }

  loadBanks(): void { this.settingsService.getBankAccounts().subscribe(r => (this.bankAccounts = r || [])); }
  loadTaxes(): void { this.settingsService.getTaxRates().subscribe(r => (this.taxRates = r || [])); }
  loadCurrencies(): void {
    this.settingsService.getCurrencies().subscribe(r => (this.currencies = r || []));
    this.settingsService.getExchangeRates().subscribe(r => (this.exchangeRates = r || []));
  }
  loadCategories(): void { this.settingsService.getExpenseCategories().subscribe(r => (this.categories = r || [])); }
  loadWarehouses(): void { this.settingsService.getWarehouses().subscribe(r => (this.warehouses = r || [])); }
  loadStages(): void { this.settingsService.getCrmStages().subscribe(r => (this.crmStages = r || [])); }
  loadNumberSeries(): void { this.settingsService.getNumberSeries().subscribe(r => (this.numberSeries = r || [])); }

  loadAuditLogs(page: number = 0): void {
    this.settingsService
      .getAuditLogs(this.auditEntityFilter.trim() || undefined, this.auditFrom || undefined, this.auditTo || undefined, page)
      .subscribe(res => (this.auditLogs = res.content || []));
  }

  saveBank(): void {
    if (this.bankForm.invalid) return;
    const raw = this.bankForm.getRawValue();
    this.settingsService.createBankAccount({
      name: raw.name!,
      bankName: raw.bankName || undefined,
      iban: raw.iban || undefined,
      currencyCode: raw.currencyCode!.toUpperCase(),
      accountKind: raw.accountKind!,
      glAccountId: raw.glAccountId!,
      isActive: true
    }).subscribe(() => {
      this.notification.success('Bank account added');
      this.bankForm.reset({ currencyCode: 'AED', accountKind: 'BANK' });
      this.loadBanks();
    });
  }

  saveTax(): void {
    if (this.taxForm.invalid) return;
    const raw = this.taxForm.getRawValue();
    this.settingsService.createTaxRate({
      code: raw.code!,
      name: raw.name!,
      taxType: raw.taxType!,
      rate: Number(raw.rate),
      isActive: true
    }).subscribe(() => {
      this.notification.success('Tax rate created');
      this.taxForm.reset({ taxType: 'STANDARD', rate: 5 });
      this.loadTaxes();
    });
  }

  saveFx(): void {
    if (this.fxForm.invalid) return;
    const raw = this.fxForm.getRawValue();
    this.settingsService.setExchangeRate({
      fromCurrency: raw.fromCurrency!,
      toCurrency: raw.toCurrency!,
      rateDate: raw.rateDate!,
      rate: Number(raw.rate)
    }).subscribe(() => {
      this.notification.success('Exchange rate recorded');
      this.loadCurrencies();
    });
  }

  saveCategory(): void {
    if (this.catForm.invalid) return;
    const raw = this.catForm.getRawValue();
    this.settingsService.createExpenseCategory({
      name: raw.name!,
      accountId: raw.accountId!,
      limitPerClaim: raw.limitPerClaim ? Number(raw.limitPerClaim) : undefined,
      receiptRequired: !!raw.receiptRequired,
      isActive: true
    }).subscribe(() => {
      this.notification.success('Expense category created');
      this.catForm.reset({ receiptRequired: true });
      this.loadCategories();
    });
  }

  saveWarehouse(): void {
    if (this.whForm.invalid) return;
    const raw = this.whForm.getRawValue();
    this.settingsService.createWarehouse({
      code: raw.code!,
      name: raw.name!,
      address: raw.address || undefined,
      isDefault: !!raw.isDefault,
      isActive: true
    }).subscribe(() => {
      this.notification.success('Warehouse created');
      this.whForm.reset({ isDefault: false });
      this.loadWarehouses();
    });
  }

  saveStage(): void {
    if (this.stageForm.invalid) return;
    const raw = this.stageForm.getRawValue();
    this.settingsService.createCrmStage({
      name: raw.name!,
      sortOrder: Number(raw.sortOrder),
      probabilityPct: Number(raw.probabilityPct),
      stageType: raw.stageType!
    }).subscribe(() => {
      this.notification.success('Pipeline stage added');
      this.stageForm.reset({ sortOrder: 10, probabilityPct: 50, stageType: 'OPEN' });
      this.loadStages();
    });
  }

  saveSeries(ns: NumberSeriesItem): void {
    this.settingsService
      .updateNumberSeries(ns.id, { prefix: ns.prefix, nextNumber: Number(ns.nextNumber), padding: Number(ns.padding) })
      .subscribe(() => {
        this.notification.success(`Updated number series for ${ns.docType}`);
        this.loadNumberSeries();
      });
  }
}
