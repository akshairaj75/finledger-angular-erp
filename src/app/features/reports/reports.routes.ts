import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'profit-loss',
    pathMatch: 'full'
  },
  {
    path: ':type',
    loadComponent: () =>
      import('./report-viewer.component').then(m => m.ReportViewerComponent)
  }
];

