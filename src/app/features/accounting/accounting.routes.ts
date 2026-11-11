import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guard';
import { ChartOfAccountsComponent } from '../settings/chart-of-accounts/chart-of-accounts.component';
import { JournalFormComponent } from './journal-form/journal-form.component';
import { JournalListComponent } from './journal-list/journal-list.component';
import { LedgerComponent } from './ledger/ledger.component';

export const ACCOUNTING_ROUTES: Routes = [
  { path: '', redirectTo: 'journals', pathMatch: 'full' },
  {
    path: 'accounts',
    canActivate: [permissionGuard],
    data: { permissions: ['ACCOUNT_VIEW', 'ACCOUNT_EDIT'] },
    component: ChartOfAccountsComponent,
    title: 'FinLedger - Chart of Accounts'
  },
  { path: 'journals', component: JournalListComponent },
  { path: 'journals/new', component: JournalFormComponent },
  { path: 'ledger', component: LedgerComponent }
];
