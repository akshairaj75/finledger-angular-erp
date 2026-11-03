import { Routes } from '@angular/router';
import { StockAdjustmentFormComponent } from './stock-adjustment-form/stock-adjustment-form.component';
import { StockOverviewComponent } from './stock-overview/stock-overview.component';
import { StockTransferFormComponent } from './stock-transfer-form/stock-transfer-form.component';

export const INVENTORY_ROUTES: Routes = [
  { path: '', redirectTo: 'items', pathMatch: 'full' },
  { path: 'items', component: StockOverviewComponent },
  { path: 'adjustments/new', component: StockAdjustmentFormComponent },
  { path: 'transfers/new', component: StockTransferFormComponent }
];

