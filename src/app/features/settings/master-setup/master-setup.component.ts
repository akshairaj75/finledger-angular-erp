import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account } from '../../../core/models/account.model';
import { AccountKind, BankAccount } from '../../../core/models/bank-account.model';
import { ExpenseCategory } from '../../../core/models/expense.model';
import { Warehouse } from '../../../core/models/inventory.model';
import { TaxRate, TaxType } from '../../../core/models/tax-rate.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="setup-page">
      <div class="page-header">
        <div>
          <h2>{{ 'settings.masterSetupTitle' | translate }}</h2>
          <p class="subtitle">{{ 'settings.masterSetupSubtitle' | translate }}</p>
        </div>
      </div>

      <div class="tabs-bar">
        <button [class.active]="tab() === 'banks'" (click)="tab.set('banks')">🏦 {{ 'settings.tabBanks' | translate }}</button>
        <button [class.active]="tab() === 'taxes'" (click)="tab.set('taxes')">📑 {{ 'settings.tabTaxes' | translate }}</button>
        <button [class.active]="tab() === 'currencies'" (click)="tab.set('currencies')">💱 {{ 'settings.tabCurrencies' | translate }}</button>
        <button [class.active]="tab() === 'categories'" (click)="tab.set('categories')">🧾 {{ 'settings.tabCategories' | translate }}</button>
        <button [class.active]="tab() === 'warehouses'" (click)="tab.set('warehouses')">🏭 {{ 'settings.tabWarehouses' | translate }}</button>
        <button [class.active]="tab() === 'stages'" (click)="tab.set('stages')">🎯 {{ 'settings.tabStages' | translate }}</button>
        <button [class.active]="tab() === 'series'" (click)="tab.set('series')">🔢 {{ 'settings.tabSeries' | translate }}</button>
        <button [class.active]="tab() === 'audit'" (click)="tab.set('audit'); loadAuditLogs()">📜 {{ 'settings.tabAudit' | translate }}</button>
      </div>

      <!-- TAB 1: BANK ACCOUNTS -->
      <div class="tab-panel" *ngIf="tab() === 'banks'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.activeBankAccounts' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'common.name' | translate }}</th><th>{{ 'settings.bankName' | translate }}</th><th>{{ 'common.currency' | translate }}</th><th>{{ 'common.type' | translate }}</th><th>{{ 'common.account' | translate }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let b of bankAccounts()">
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
            <h3>{{ 'settings.addBankAccount' | translate }}</h3>
            <form [formGroup]="bankForm" (ngSubmit)="saveBank()" class="stack-form">
              <label>{{ 'settings.accountName' | translate }} * <input type="text" formControlName="name" [placeholder]="'settings.accountNamePlaceholder' | translate" /></label>
              <label>{{ 'settings.bankName' | translate }} <input type="text" formControlName="bankName" [placeholder]="'settings.bankNamePlaceholder' | translate" /></label>
              <label>{{ 'purchases.bankIban' | translate }} <input type="text" formControlName="iban" placeholder="AE..." /></label>
              <label>{{ 'common.currency' | translate }} * <input type="text" formControlName="currencyCode" maxlength="3" /></label>
              <label>{{ 'settings.accountKind' | translate }} *
                <select formControlName="accountKind">
                  <option value="BANK">BANK</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                </select>
              </label>
              <label>{{ 'settings.linkedGlAccount' | translate }} *
                <select formControlName="glAccountId">
                  <option *ngFor="let a of assetAccounts()" [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option>
                </select>
              </label>
              <button type="submit" class="btn-primary" [disabled]="bankForm.invalid">{{ 'settings.addBankAccount' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 2: TAX RATES -->
      <div class="tab-panel" *ngIf="tab() === 'taxes'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.configuredTaxRates' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'common.code' | translate }}</th><th>{{ 'common.name' | translate }}</th><th>{{ 'common.type' | translate }}</th><th>{{ 'settings.rate' | translate }} (%)</th></tr></thead>
              <tbody>
                <tr *ngFor="let t of taxRates()">
                  <td class="font-medium">{{ t.code }}</td>
                  <td>{{ t.name }}</td>
                  <td>{{ t.taxType }}</td>
                  <td>{{ t.rate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>{{ 'settings.addTaxRate' | translate }}</h3>
            <form [formGroup]="taxForm" (ngSubmit)="saveTax()" class="stack-form">
              <label>{{ 'settings.taxCode' | translate }} * <input type="text" formControlName="code" placeholder="VAT5-NEW" /></label>
              <label>{{ 'common.name' | translate }} * <input type="text" formControlName="name" placeholder="Standard 5%" /></label>
              <label>{{ 'common.type' | translate }} *
                <select formControlName="taxType">
                  <option value="STANDARD">STANDARD</option>
                  <option value="ZERO">ZERO</option>
                  <option value="EXEMPT">EXEMPT</option>
                  <option value="OUT_OF_SCOPE">OUT_OF_SCOPE</option>
                </select>
              </label>
              <label>{{ 'settings.rate' | translate }} % * <input type="number" step="0.01" formControlName="rate" /></label>
              <button type="submit" class="btn-primary" [disabled]="taxForm.invalid">{{ 'settings.saveTaxRate' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 3: CURRENCIES & FX -->
      <div class="tab-panel" *ngIf="tab() === 'currencies'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.exchangeRates' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'common.currency' | translate }}</th><th>{{ 'common.date' | translate }}</th><th>{{ 'settings.rate' | translate }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let fx of exchangeRates()">
                  <td class="font-medium">{{ fx.fromCurrency }} → {{ fx.toCurrency }}</td>
                  <td>{{ fx.rateDate }}</td>
                  <td>{{ fx.rate }}</td>
                </tr>
                <tr *ngIf="!exchangeRates().length"><td colspan="3" class="text-muted">{{ 'settings.noCustomRates' | translate }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>{{ 'settings.recordExchangeRate' | translate }}</h3>
            <form [formGroup]="fxForm" (ngSubmit)="saveFx()" class="stack-form">
              <label>{{ 'settings.fromCurrency' | translate }} *
                <select formControlName="fromCurrency">
                  <option *ngFor="let c of currencies()" [value]="c.code">{{ c.code }} - {{ c.name }}</option>
                </select>
              </label>
              <label>{{ 'settings.toCurrency' | translate }} *
                <select formControlName="toCurrency">
                  <option *ngFor="let c of currencies()" [value]="c.code">{{ c.code }} - {{ c.name }}</option>
                </select>
              </label>
              <label>{{ 'settings.effectiveDate' | translate }} * <input type="date" formControlName="rateDate" /></label>
              <label>{{ 'settings.rate' | translate }} * <input type="number" step="0.0001" formControlName="rate" /></label>
              <button type="submit" class="btn-primary" [disabled]="fxForm.invalid">{{ 'settings.setRate' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 4: EXPENSE CATEGORIES -->
      <div class="tab-panel" *ngIf="tab() === 'categories'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.expensePolicyCategories' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'common.name' | translate }}</th><th>{{ 'common.account' | translate }}</th><th>{{ 'expenses.policyLimit' | translate }}</th><th>{{ 'expenses.receipt' | translate }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of categories()">
                  <td class="font-medium">{{ c.name }}</td>
                  <td>{{ getAccountLabel(c.accountId) }}</td>
                  <td>{{ c.limitPerClaim ? (c.limitPerClaim | number:'1.2-2') : ('expenses.noLimit' | translate) }}</td>
                  <td>{{ c.receiptRequired ? ('common.yes' | translate) : ('common.optional' | translate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>{{ 'settings.addExpenseCategory' | translate }}</h3>
            <form [formGroup]="catForm" (ngSubmit)="saveCategory()" class="stack-form">
              <label>{{ 'settings.categoryName' | translate }} * <input type="text" formControlName="name" [placeholder]="'settings.categoryNamePlaceholder' | translate" /></label>
              <label>{{ 'settings.expenseGlAccount' | translate }} *
                <select formControlName="accountId">
                  <option *ngFor="let a of expenseAccounts()" [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option>
                </select>
              </label>
              <label>{{ 'settings.perClaimLimit' | translate }} ({{ 'common.optional' | translate }}) <input type="number" formControlName="limitPerClaim" /></label>
              <label class="inline-check"><input type="checkbox" formControlName="receiptRequired" /> {{ 'settings.requireReceiptUpload' | translate }}</label>
              <button type="submit" class="btn-primary" [disabled]="catForm.invalid">{{ 'settings.addCategory' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 5: WAREHOUSES -->
      <div class="tab-panel" *ngIf="tab() === 'warehouses'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.configuredWarehouses' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'common.code' | translate }}</th><th>{{ 'common.name' | translate }}</th><th>{{ 'common.address' | translate }}</th><th>{{ 'common.status' | translate }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let w of warehouses()">
                  <td class="font-medium">{{ w.code }}</td>
                  <td>{{ w.name }}</td>
                  <td>{{ w.address || '-' }}</td>
                  <td>{{ w.isDefault ? ('⭐ ' + ('settings.defaultTag' | translate)) : ('common.no' | translate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>{{ 'settings.addWarehouse' | translate }}</h3>
            <form [formGroup]="whForm" (ngSubmit)="saveWarehouse()" class="stack-form">
              <label>{{ 'settings.warehouseCode' | translate }} * <input type="text" formControlName="code" placeholder="WH-SHJ" /></label>
              <label>{{ 'settings.warehouseName' | translate }} * <input type="text" formControlName="name" placeholder="Sharjah Distribution Center" /></label>
              <label>{{ 'common.address' | translate }} <input type="text" formControlName="address" /></label>
              <label class="inline-check"><input type="checkbox" formControlName="isDefault" /> {{ 'settings.markAsDefaultWarehouse' | translate }}</label>
              <button type="submit" class="btn-primary" [disabled]="whForm.invalid">{{ 'settings.createWarehouse' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 6: CRM PIPELINE STAGES (Section 4.16) -->
      <div class="tab-panel" *ngIf="tab() === 'stages'">
        <div class="panel-grid">
          <div class="card">
            <h3>{{ 'settings.salesPipelineStages' | translate }}</h3>
            <table class="data-table">
              <thead><tr><th>{{ 'settings.order' | translate }}</th><th>{{ 'settings.stageName' | translate }}</th><th>{{ 'crm.winProbability' | translate }}</th><th>{{ 'settings.stageType' | translate }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let s of crmStages()">
                  <td>{{ s.sortOrder }}</td>
                  <td class="font-medium">{{ s.name }}</td>
                  <td>{{ s.probabilityPct }}%</td>
                  <td><span class="pill" [ngClass]="'pill-' + s.stageType">{{ s.stageType }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card form-card">
            <h3>{{ 'settings.addPipelineStage' | translate }}</h3>
            <form [formGroup]="stageForm" (ngSubmit)="saveStage()" class="stack-form">
              <label>{{ 'settings.stageName' | translate }} * <input type="text" formControlName="name" placeholder="Technical Review" /></label>
              <label>{{ 'settings.sortOrder' | translate }} * <input type="number" formControlName="sortOrder" min="1" /></label>
              <label>{{ 'crm.winProbability' | translate }} (%) * <input type="number" formControlName="probabilityPct" min="0" max="100" /></label>
              <label>{{ 'settings.stageType' | translate }} *
                <select formControlName="stageType">
                  <option value="OPEN">OPEN</option>
                  <option value="WON">WON</option>
                  <option value="LOST">LOST</option>
                </select>
              </label>
              <button type="submit" class="btn-primary" [disabled]="stageForm.invalid">{{ 'settings.createStage' | translate }}</button>
            </form>
          </div>
        </div>
      </div>

      <!-- TAB 7: NUMBER SERIES (Section 4.16) -->
      <div class="tab-panel" *ngIf="tab() === 'series'">
        <div class="card">
          <h3>{{ 'settings.docNumberSeries' | translate }}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'common.type' | translate }}</th>
                <th>{{ 'settings.prefix' | translate }}</th>
                <th>{{ 'settings.nextSequence' | translate }}</th>
                <th>{{ 'settings.zeroPadding' | translate }}</th>
                <th class="text-right">{{ 'common.action' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ns of numberSeries()">
                <td class="font-medium">{{ ns.docType }}</td>
                <td><input type="text" [ngModel]="ns.prefix" (ngModelChange)="ns.prefix = $event" class="inline-input" /></td>
                <td><input type="number" [ngModel]="ns.nextNumber" (ngModelChange)="ns.nextNumber = $event" min="1" class="inline-input short" /></td>
                <td><input type="number" [ngModel]="ns.padding" (ngModelChange)="ns.padding = $event" min="1" max="8" class="inline-input short" /></td>
                <td class="text-right">
                  <button type="button" class="btn-sm" (click)="saveSeries(ns)">{{ 'common.save' | translate }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 8: AUDIT LOGS (Section 4.16 / 6.2) -->
      <div class="tab-panel" *ngIf="tab() === 'audit'">
        <div class="card">
          <div class="audit-toolbar">
            <h3>{{ 'settings.systemAuditTrail' | translate }}</h3>
            <div class="audit-filters">
              <input type="text" [ngModel]="auditEntityFilter()" (ngModelChange)="auditEntityFilter.set($event)" [placeholder]="'settings.filterByEntity' | translate" class="inline-input" />
              <input type="date" [ngModel]="auditFrom()" (ngModelChange)="auditFrom.set($event)" class="inline-input" />
              <input type="date" [ngModel]="auditTo()" (ngModelChange)="auditTo.set($event)" class="inline-input" />
              <button type="button" class="btn-sm" (click)="loadAuditLogs(0)">{{ 'common.filter' | translate }}</button>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'settings.timestamp' | translate }}</th>
                <th>{{ 'common.user' | translate }}</th>
                <th>{{ 'common.action' | translate }}</th>
                <th>{{ 'settings.entity' | translate }}</th>
                <th>{{ 'settings.recordId' | translate }}</th>
                <th>{{ 'settings.changeDetails' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of auditLogs()">
                <td>{{ log.createdAt | date:'short' }}</td>
                <td class="font-medium">{{ log.userName }}</td>
                <td><span class="pill pill-OPEN">{{ log.action }}</span></td>
                <td>{{ log.entityName }}</td>
                <td>#{{ log.entityId }}</td>
                <td class="audit-json">{{ log.newValues || log.oldValues || '-' }}</td>
              </tr>
              <tr *ngIf="!auditLogs().length">
                <td colspan="6" class="text-muted">{{ 'settings.noAuditEntries' | translate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .setup-page { padding: 1.5rem; max-width: 1440px; margin: 0 auto; width: 100%; }
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
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; overflow-x: auto; width: 100%; max-width: 100%; -webkit-overflow-scrolling: touch; }
    .card h3 { margin: 0 0 1rem; font-size: 1.05rem; color: #0f172a; }
    .data-table { width: 100%; min-width: 520px; border-collapse: collapse; }
    .data-table th { text-align: start; padding: 0.6rem; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 0.65rem 0.6rem; font-size: 0.86rem; border-bottom: 1px solid #f1f5f9; }
    .font-medium { font-weight: 600; }
    .text-right { text-align: end; }
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

    @media (max-width: 767px) {
      .setup-page { padding: 0.75rem; }
      .page-header { flex-direction: column; align-items: flex-start; }
      .tabs-bar { gap: 0.35rem; }
      .tabs-bar button { padding: 0.4rem 0.65rem; font-size: 0.78rem; flex: 1 1 auto; text-align: center; }
      .panel-grid { grid-template-columns: 1fr; }
      .card { padding: 0.85rem; }
    }
  `]
})
export class MasterSetupComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  tab = signal<SetupTab>('banks');
  accounts = signal<Account[]>([]);
  bankAccounts = signal<BankAccount[]>([]);
  taxRates = signal<TaxRate[]>([]);
  currencies = signal<CurrencyItem[]>([]);
  exchangeRates = signal<ExchangeRateItem[]>([]);
  categories = signal<ExpenseCategory[]>([]);
  warehouses = signal<Warehouse[]>([]);
  crmStages = signal<CrmStageItem[]>([]);
  numberSeries = signal<NumberSeriesItem[]>([]);
  auditLogs = signal<AuditLogItem[]>([]);

  auditEntityFilter = signal<string>('');
  auditFrom = signal<string>('');
  auditTo = signal<string>('');

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

  assetAccounts = computed<Account[]>(() =>
    this.accounts().filter(a => !a.isGroup && a.accountType === 'ASSET')
  );

  expenseAccounts = computed<Account[]>(() =>
    this.accounts().filter(a => !a.isGroup && a.accountType === 'EXPENSE')
  );

  ngOnInit(): void {
    this.settingsService.getAccounts().subscribe(res => this.accounts.set(res.content || []));
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
    const acc = this.accounts().find(a => a.id === id);
    return acc ? `${acc.code} - ${acc.name}` : `#${id}`;
  }

  loadBanks(): void { this.settingsService.getBankAccounts().subscribe(r => this.bankAccounts.set(r || [])); }
  loadTaxes(): void { this.settingsService.getTaxRates().subscribe(r => this.taxRates.set(r || [])); }
  loadCurrencies(): void {
    this.settingsService.getCurrencies().subscribe(r => this.currencies.set(r || []));
    this.settingsService.getExchangeRates().subscribe(r => this.exchangeRates.set(r || []));
  }
  loadCategories(): void { this.settingsService.getExpenseCategories().subscribe(r => this.categories.set(r || [])); }
  loadWarehouses(): void { this.settingsService.getWarehouses().subscribe(r => this.warehouses.set(r || [])); }
  loadStages(): void { this.settingsService.getCrmStages().subscribe(r => this.crmStages.set(r || [])); }
  loadNumberSeries(): void { this.settingsService.getNumberSeries().subscribe(r => this.numberSeries.set(r || [])); }

  loadAuditLogs(page: number = 0): void {
    this.settingsService
      .getAuditLogs(
        this.auditEntityFilter().trim() || undefined,
        this.auditFrom() || undefined,
        this.auditTo() || undefined,
        page
      )
      .subscribe(res => this.auditLogs.set(res.content || []));
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
