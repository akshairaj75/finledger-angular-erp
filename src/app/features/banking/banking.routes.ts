import { Routes } from '@angular/router';

export const BANKING_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'reconciliation',
    pathMatch: 'full'
  },
  {
    path: 'reconciliation',
    loadComponent: () =>
      import('./reconciliation/reconciliation.component').then(m => m.ReconciliationComponent)
  }
];

