import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Account, AccountNode } from '../../../core/models/account.model';
import { CompanyProfile } from '../../../core/models/auth.model';
import { BankAccount } from '../../../core/models/bank-account.model';
import { ExpenseCategory } from '../../../core/models/expense.model';
import { Warehouse } from '../../../core/models/inventory.model';
import { Page } from '../../../core/models/page.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { User } from '../../../core/models/user.model';
import {
  AuditLogItem,
  CompanyUpdateRequest,
  CreateFiscalYearRequest,
  CreateUserRequest,
  CrmStageItem,
  CrmStageRequest,
  CurrencyItem,
  ExchangeRateItem,
  ExchangeRateRequest,
  FiscalPeriod,
  FiscalYear,
  NumberSeriesItem,
  PermissionItem,
  Role,
  RoleRequest,
  UpdateUserRequest
} from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private api = environment.apiBaseUrl;

  // Company Profile
  getCurrentCompany(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${this.api}/companies/current`);
  }

  updateCurrentCompany(req: CompanyUpdateRequest): Observable<CompanyProfile> {
    return this.http.put<CompanyProfile>(`${this.api}/companies/current`, req);
  }

  // Users
  getUsers(page: number = 0, size: number = 50): Observable<Page<User>> {
    return this.http.get<Page<User>>(`${this.api}/users?page=${page}&size=${size}`);
  }

  createUser(req: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.api}/users`, req);
  }

  updateUser(id: number, req: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.api}/users/${id}`, req);
  }

  // Roles & Permissions
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.api}/roles`);
  }

  createRole(req: RoleRequest): Observable<Role> {
    return this.http.post<Role>(`${this.api}/roles`, req);
  }

  updateRole(id: number, req: RoleRequest): Observable<Role> {
    return this.http.put<Role>(`${this.api}/roles/${id}`, req);
  }

  getAllPermissions(): Observable<PermissionItem[]> {
    return this.http.get<PermissionItem[]>(`${this.api}/roles/permissions`);
  }

  // Fiscal Years & Periods
  getFiscalYears(): Observable<FiscalYear[]> {
    return this.http.get<FiscalYear[]>(`${this.api}/fiscal-years`);
  }

  createFiscalYear(req: CreateFiscalYearRequest): Observable<FiscalYear> {
    return this.http.post<FiscalYear>(`${this.api}/fiscal-years`, req);
  }

  closeFiscalPeriod(periodId: number): Observable<FiscalPeriod> {
    return this.http.post<FiscalPeriod>(`${this.api}/fiscal-periods/${periodId}/close`, {});
  }

  // Chart of Accounts
  getAccountTree(): Observable<AccountNode[]> {
    return this.http.get<AccountNode[]>(`${this.api}/accounts/tree`);
  }

  getAccounts(size: number = 200): Observable<Page<Account>> {
    return this.http.get<Page<Account>>(`${this.api}/accounts?size=${size}`);
  }

  createAccount(req: Partial<Account>): Observable<Account> {
    return this.http.post<Account>(`${this.api}/accounts`, req);
  }

  updateAccount(id: number, req: Partial<Account>): Observable<Account> {
    return this.http.put<Account>(`${this.api}/accounts/${id}`, req);
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/accounts/${id}`);
  }

  // Bank Accounts
  getBankAccounts(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.api}/bank-accounts?activeOnly=false`);
  }

  createBankAccount(req: Partial<BankAccount>): Observable<BankAccount> {
    return this.http.post<BankAccount>(`${this.api}/bank-accounts`, req);
  }

  updateBankAccount(id: number, req: Partial<BankAccount>): Observable<BankAccount> {
    return this.http.put<BankAccount>(`${this.api}/bank-accounts/${id}`, req);
  }

  // Tax Rates
  getTaxRates(): Observable<TaxRate[]> {
    return this.http.get<TaxRate[]>(`${this.api}/tax-rates`);
  }

  createTaxRate(req: Partial<TaxRate>): Observable<TaxRate> {
    return this.http.post<TaxRate>(`${this.api}/tax-rates`, req);
  }

  updateTaxRate(id: number, req: Partial<TaxRate>): Observable<TaxRate> {
    return this.http.put<TaxRate>(`${this.api}/tax-rates/${id}`, req);
  }

  // Currencies & FX
  getCurrencies(): Observable<CurrencyItem[]> {
    return this.http.get<CurrencyItem[]>(`${this.api}/currencies`);
  }

  getExchangeRates(): Observable<ExchangeRateItem[]> {
    return this.http.get<ExchangeRateItem[]>(`${this.api}/currencies/exchange-rates`);
  }

  setExchangeRate(req: ExchangeRateRequest): Observable<ExchangeRateItem> {
    return this.http.post<ExchangeRateItem>(`${this.api}/currencies/exchange-rates`, req);
  }

  // Expense Categories
  getExpenseCategories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.api}/expense-categories/all`);
  }

  createExpenseCategory(req: Partial<ExpenseCategory>): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(`${this.api}/expense-categories`, req);
  }

  updateExpenseCategory(id: number, req: Partial<ExpenseCategory>): Observable<ExpenseCategory> {
    return this.http.put<ExpenseCategory>(`${this.api}/expense-categories/${id}`, req);
  }

  // Warehouses
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.api}/warehouses`);
  }

  createWarehouse(req: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${this.api}/warehouses`, req);
  }

  updateWarehouse(id: number, req: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.put<Warehouse>(`${this.api}/warehouses/${id}`, req);
  }

  // CRM Pipeline Stages (Section 4.16 / 6.2)
  getCrmStages(): Observable<CrmStageItem[]> {
    return this.http.get<CrmStageItem[]>(`${this.api}/crm/stages`);
  }

  createCrmStage(req: CrmStageRequest): Observable<CrmStageItem> {
    return this.http.post<CrmStageItem>(`${this.api}/crm/stages`, req);
  }

  updateCrmStage(id: number, req: CrmStageRequest): Observable<CrmStageItem> {
    return this.http.put<CrmStageItem>(`${this.api}/crm/stages/${id}`, req);
  }

  // Document Number Series (Section 4.16)
  getNumberSeries(): Observable<NumberSeriesItem[]> {
    return this.http.get<NumberSeriesItem[]>(`${this.api}/number-series`);
  }

  updateNumberSeries(
    id: number,
    req: { prefix: string; nextNumber: number; padding: number }
  ): Observable<NumberSeriesItem> {
    return this.http.put<NumberSeriesItem>(`${this.api}/number-series/${id}`, req);
  }

  // Audit Trail Logs (Section 4.16 / 6.2)
  getAuditLogs(entity?: string, from?: string, to?: string, page: number = 0): Observable<Page<AuditLogItem>> {
    const params = new URLSearchParams({ page: String(page), size: '25' });
    if (entity) params.set('entity', entity);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.http.get<Page<AuditLogItem>>(`${this.api}/audit-logs?${params.toString()}`);
  }
}

