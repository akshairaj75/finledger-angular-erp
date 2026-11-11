import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'FinLedger - Sign In'
  },
  {
    path: 'auth/login',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'unauthorized',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
    title: 'FinLedger - Access Denied'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'FinLedger - Executive Dashboard'
  },
  {
    path: 'banking',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['BANK_RECONCILE'] },
    loadChildren: () => import('./features/banking/banking.routes').then(m => m.BANKING_ROUTES)
  },
  {
    path: 'reports',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['REPORT_VIEW', 'LEDGER_VIEW'] },
    loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
  },
  {
    path: 'crm',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['LEAD_VIEW', 'OPPORTUNITY_VIEW', 'QUOTATION_VIEW', 'CRM_VIEW_ALL'] },
    loadChildren: () => import('./features/crm/crm.routes').then(m => m.CRM_ROUTES)
  },
  {
    path: 'accounting',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['JOURNAL_VIEW', 'LEDGER_VIEW', 'ACCOUNT_VIEW'] },
    loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES)
  },
  {
    path: 'sales',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['INVOICE_VIEW', 'INVOICE_CREATE', 'RECEIPT_VIEW', 'CUSTOMER_VIEW'] },
    loadChildren: () => import('./features/sales/sales.routes').then(m => m.SALES_ROUTES)
  },
  {
    path: 'purchases',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['BILL_VIEW', 'PAYMENT_VIEW', 'VENDOR_VIEW'] },
    loadChildren: () => import('./features/purchases/purchases.routes').then(m => m.PURCHASES_ROUTES)
  },
  {
    path: 'inventory',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['ITEM_VIEW', 'STOCK_ADJUST', 'STOCK_TRANSFER'] },
    loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
  },
  {
    path: 'expenses',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE', 'EXPENSE_REIMBURSE'] },
    loadChildren: () => import('./features/expenses/expenses.routes').then(m => m.EXPENSES_ROUTES)
  },
  {
    path: 'settings',
    canActivate: [authGuard, permissionGuard],
    data: {
      permissions: [
        'COMPANY_VIEW', 'COMPANY_EDIT', 'SETTINGS_VIEW', 'SETTINGS_EDIT',
        'USER_VIEW', 'ROLE_VIEW', 'ACCOUNT_VIEW'
      ]
    },
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
  },
  { path: '**', redirectTo: 'dashboard' }
];
