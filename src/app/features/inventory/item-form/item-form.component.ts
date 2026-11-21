import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import {
  CostingMethod,
  Item,
  ItemCategory,
  ItemRequest,
  ItemType,
  StockMovement
} from '../../../core/models/inventory.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../../accounting/services/account.service';
import { SettingsService } from '../../settings/services/settings.service';
import { InventoryService } from '../services/inventory.service';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './item-form.component.html',
  styleUrls: ['./item-form.component.css']
})
export class ItemFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private accountService = inject(AccountService);
  private settingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  itemForm!: FormGroup;
  isEditMode = signal(false);
  itemId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);

  // Dropdown catalogs
  categories = signal<ItemCategory[]>([]);
  taxRates = signal<TaxRate[]>([]);
  incomeAccounts = signal<Account[]>([]);
  cogsAccounts = signal<Account[]>([]);
  inventoryAccounts = signal<Account[]>([]);

  // Movements ledger for edit mode
  movements = signal<StockMovement[]>([]);
  loadingMovements = signal(false);

  readonly itemTypes: { value: ItemType; label: string }[] = [
    { value: 'INVENTORY', label: 'Inventory (Stocked Item)' },
    { value: 'NON_INVENTORY', label: 'Non-Inventory Consumable' },
    { value: 'SERVICE', label: 'Service / Labor' }
  ];

  readonly costingMethods: { value: CostingMethod; label: string }[] = [
    { value: 'WEIGHTED_AVERAGE', label: 'Weighted Average Costing' },
    { value: 'FIFO', label: 'First-In, First-Out (FIFO)' }
  ];

  readonly units = ['PCS', 'KG', 'BOX', 'MTR', 'LTR', 'SET', 'HR'];

  ngOnInit(): void {
    this.initForm();
    this.loadDropdowns();

    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId && paramId !== 'new') {
      const id = Number(paramId);
      if (!isNaN(id)) {
        this.isEditMode.set(true);
        this.itemId.set(id);
        this.loadItem(id);
      }
    }
  }

  private initForm(): void {
    this.itemForm = this.fb.group({
      sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-_]+$/)]],
      barcode: [''],
      name: ['', [Validators.required, Validators.minLength(2)]],
      categoryId: [null],
      itemType: ['INVENTORY' as ItemType, [Validators.required]],
      unit: ['PCS', [Validators.required]],
      costingMethod: ['WEIGHTED_AVERAGE' as CostingMethod, [Validators.required]],
      salesPrice: [0, [Validators.required, Validators.min(0)]],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      reorderLevel: [0, [Validators.min(0)]],
      reorderQty: [0, [Validators.min(0)]],
      incomeAccountId: [null],
      cogsAccountId: [null],
      inventoryAccountId: [null],
      taxRateId: [null],
      isActive: [true]
    });
  }

  private loadDropdowns(): void {
    this.inventoryService.getCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => {}
    });

    this.settingsService.getTaxRates().subscribe({
      next: rates => this.taxRates.set(rates),
      error: () => {}
    });

    this.accountService.getAccounts(0, 500).subscribe({
      next: page => {
        const accs = page.content;
        this.incomeAccounts.set(accs.filter(a => a.accountType === 'INCOME'));
        this.cogsAccounts.set(accs.filter(a => a.accountType === 'EXPENSE'));
        this.inventoryAccounts.set(accs.filter(a => a.accountType === 'ASSET'));
      },
      error: () => {}
    });
  }

  loadItem(id: number): void {
    this.loading.set(true);
    this.inventoryService.getItemById(id).subscribe({
      next: item => {
        this.itemForm.patchValue({
          sku: item.sku,
          barcode: item.barcode || '',
          name: item.name,
          categoryId: item.categoryId || null,
          itemType: item.itemType,
          unit: item.unit || 'PCS',
          costingMethod: item.costingMethod || 'WEIGHTED_AVERAGE',
          salesPrice: item.salesPrice || 0,
          purchasePrice: item.purchasePrice || 0,
          reorderLevel: item.reorderLevel || 0,
          reorderQty: item.reorderQty || 0,
          incomeAccountId: item.incomeAccountId || null,
          cogsAccountId: item.cogsAccountId || null,
          inventoryAccountId: item.inventoryAccountId || null,
          taxRateId: item.taxRateId || null,
          isActive: item.isActive !== undefined ? item.isActive : true
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notificationService.error('Failed to load item details.');
        this.router.navigate(['/inventory/items']);
      }
    });

    // Load Stock Movements Ledger
    this.loadingMovements.set(true);
    this.inventoryService.getItemMovements(id).subscribe({
      next: list => {
        this.movements.set(list);
        this.loadingMovements.set(false);
      },
      error: () => this.loadingMovements.set(false)
    });
  }

  onSubmit(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      this.notificationService.warning('Please complete all required item fields.');
      return;
    }

    this.saving.set(true);
    const formVal = this.itemForm.value;
    const req: ItemRequest = {
      sku: formVal.sku.trim().toUpperCase(),
      barcode: formVal.barcode?.trim() || undefined,
      name: formVal.name.trim(),
      categoryId: formVal.categoryId ? Number(formVal.categoryId) : undefined,
      itemType: formVal.itemType,
      unit: formVal.unit,
      costingMethod: formVal.costingMethod,
      salesPrice: Number(formVal.salesPrice) || 0,
      purchasePrice: Number(formVal.purchasePrice) || 0,
      reorderLevel: Number(formVal.reorderLevel) || 0,
      reorderQty: Number(formVal.reorderQty) || 0,
      incomeAccountId: formVal.incomeAccountId ? Number(formVal.incomeAccountId) : undefined,
      cogsAccountId: formVal.cogsAccountId ? Number(formVal.cogsAccountId) : undefined,
      inventoryAccountId: formVal.inventoryAccountId ? Number(formVal.inventoryAccountId) : undefined,
      taxRateId: formVal.taxRateId ? Number(formVal.taxRateId) : undefined,
      isActive: Boolean(formVal.isActive)
    };

    if (this.isEditMode() && this.itemId()) {
      this.inventoryService.updateItem(this.itemId()!, req).subscribe({
        next: updated => {
          this.saving.set(false);
          this.notificationService.success(`Item "${updated.sku}" updated successfully.`);
          this.router.navigate(['/inventory/items']);
        },
        error: err => {
          this.saving.set(false);
          this.notificationService.error(err?.error?.message || 'Failed to update item.');
        }
      });
    } else {
      this.inventoryService.createItem(req).subscribe({
        next: created => {
          this.saving.set(false);
          this.notificationService.success(`Item "${created.sku}" created successfully.`);
          this.router.navigate(['/inventory/items']);
        },
        error: err => {
          this.saving.set(false);
          this.notificationService.error(err?.error?.message || 'Failed to create item.');
        }
      });
    }
  }
}
