import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'accounting/journals', pathMatch: 'full' },
  {
    path: 'accounting',
    loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES)
  },
  { path: '**', redirectTo: 'accounting/journals' }
];
