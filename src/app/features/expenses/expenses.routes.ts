import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guard';
import { ExpenseFormComponent } from './expense-form/expense-form.component';
import { ExpenseListComponent } from './expense-list/expense-list.component';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    component: ExpenseListComponent
  },
  {
    path: 'approvals',
    canActivate: [permissionGuard],
    data: { permissions: ['EXPENSE_APPROVE'], defaultTab: 'approvals' },
    component: ExpenseListComponent,
    title: 'FinLedger - Expense Approvals'
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
