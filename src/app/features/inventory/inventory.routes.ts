import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guard';
import { ItemFormComponent } from './item-form/item-form.component';
import { StockAdjustmentFormComponent } from './stock-adjustment-form/stock-adjustment-form.component';
import { StockOverviewComponent } from './stock-overview/stock-overview.component';
import { StockTransferFormComponent } from './stock-transfer-form/stock-transfer-form.component';

export const INVENTORY_ROUTES: Routes = [
  { path: '', redirectTo: 'items', pathMatch: 'full' },
  { path: 'items', component: StockOverviewComponent },
  {
    path: 'items/new',
    component: ItemFormComponent,
    canActivate: [permissionGuard],
    data: { permissions: ['ITEM_CREATE', 'ITEM_EDIT'] }
  },
  {
    path: 'items/:id',
    component: ItemFormComponent,
    canActivate: [permissionGuard],
    data: { permissions: ['ITEM_EDIT'] }
  },
  { path: 'adjustments/new', component: StockAdjustmentFormComponent },
  { path: 'transfers/new', component: StockTransferFormComponent }
];
