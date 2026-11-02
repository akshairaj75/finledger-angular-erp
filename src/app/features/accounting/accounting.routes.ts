import { Routes } from '@angular/router';
import { JournalFormComponent } from './journal-form/journal-form.component';
import { JournalListComponent } from './journal-list/journal-list.component';
import { LedgerComponent } from './ledger/ledger.component';

export const ACCOUNTING_ROUTES: Routes = [
  { path: '', redirectTo: 'journals', pathMatch: 'full' },
  { path: 'journals', component: JournalListComponent },
  { path: 'journals/new', component: JournalFormComponent },
  { path: 'ledger', component: LedgerComponent }
];

