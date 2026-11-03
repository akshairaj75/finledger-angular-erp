import { Routes } from '@angular/router';
import { BillFormComponent } from './bill-form/bill-form.component';
import { BillListComponent } from './bill-list/bill-list.component';
import { PaymentFormComponent } from './payment-form/payment-form.component';
import { VendorListComponent } from './vendor-list/vendor-list.component';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'bills',
    pathMatch: 'full'
  },
  {
    path: 'vendors',
    component: VendorListComponent,
    title: 'FinLedger - Vendors & Suppliers'
  },
  {
    path: 'bills',
    component: BillListComponent,
    title: 'FinLedger - Vendor Bills & Payables'
  },
  {
    path: 'bills/new',
    component: BillFormComponent,
    title: 'FinLedger - New Vendor Bill'
  },
  {
    path: 'payments/new',
    component: PaymentFormComponent,
    title: 'FinLedger - Vendor Payment'
  }
];

