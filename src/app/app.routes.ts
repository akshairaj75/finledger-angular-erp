import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'sales/invoices', pathMatch: 'full' },
  {
    path: 'accounting',
    loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES)
  },
  {
    path: 'sales',
    loadChildren: () => import('./features/sales/sales.routes').then(m => m.SALES_ROUTES)
  },
  {
    path: 'purchases',
    loadChildren: () => import('./features/purchases/purchases.routes').then(m => m.PURCHASES_ROUTES)
  },
  {
    path: 'inventory',
    loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
  },
  {
    path: 'expenses',
    loadChildren: () => import('./features/expenses/expenses.routes').then(m => m.EXPENSES_ROUTES)
  },
  { path: '**', redirectTo: 'sales/invoices' }
];
