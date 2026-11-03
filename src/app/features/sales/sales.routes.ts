import { Routes } from '@angular/router';
import { CustomerListComponent } from './customer-list/customer-list.component';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { InvoiceListComponent } from './invoice-list/invoice-list.component';
import { ReceiptFormComponent } from './receipt-form/receipt-form.component';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'invoices',
    pathMatch: 'full'
  },
  {
    path: 'customers',
    component: CustomerListComponent,
    title: 'FinLedger - Customers'
  },
  {
    path: 'invoices',
    component: InvoiceListComponent,
    title: 'FinLedger - Sales Invoices'
  },
  {
    path: 'invoices/new',
    component: InvoiceFormComponent,
    title: 'FinLedger - New Invoice'
  },
  {
    path: 'receipts/new',
    component: ReceiptFormComponent,
    title: 'FinLedger - Customer Receipt'
  }
];

