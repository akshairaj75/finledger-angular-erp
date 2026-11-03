import { Routes } from '@angular/router';
import { ExpenseFormComponent } from './expense-form/expense-form.component';
import { ExpenseListComponent } from './expense-list/expense-list.component';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    component: ExpenseListComponent
  },
  {
    path: 'new',
    component: ExpenseFormComponent
  },
  {
    path: ':id',
    component: ExpenseFormComponent
  }
];

