import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import {
  AdjustmentReason,
  Item,
  StockAdjustment,
  StockAdjustmentRequest,
  StockBalance,
  Warehouse
} from '../../../core/models/inventory.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../../accounting/services/account.service';
import { InventoryService } from '../services/inventory.service';

export interface AdjustmentLineSummary {
  itemId: number;
  sku: string;
  name: string;
  systemQty: number;
  countedQty: number;
  differenceQty: number;
  unitCost: number;
  valueImpact: number;
}

export interface JournalPreviewLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

@Component({
  selector: 'app-stock-adjustment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './stock-adjustment-form.component.html',
  styleUrls: ['./stock-adjustment-form.component.css']
})
export class StockAdjustmentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private inventoryService = inject(InventoryService);
  private accountService = inject(AccountService);
  private notificationService = inject(NotificationService);

  adjustmentForm!: FormGroup;

  warehouses: Warehouse[] = [];
  expenseAccounts: Account[] = [];
  catalogItems: Item[] = [];

  // Barcode / Item Search
  barcodeInput = '';
  selectedItemId: number | null = null;

  loading = true;
  saving = false;
  posting = false;
  loadingWarehouseStock = false;

  // Live Calculations
  lineSummaries: AdjustmentLineSummary[] = [];
  totalShortageValue = 0;
  totalSurplusValue = 0;
  netValueImpact = 0;
  journalPreview: JournalPreviewLine[] = [];

  reasons: { value: AdjustmentReason; label: string }[] = [
    { value: 'STOCK_COUNT', label: 'Stock Count Variance' },
    { value: 'DAMAGED', label: 'Damaged Goods' },
    { value: 'EXPIRED', label: 'Expired Stock' },
    { value: 'THEFT', label: 'Shrinkage / Theft' },
    { value: 'OPENING', label: 'Opening Balance Setup' },
    { value: 'OTHER', label: 'Other Reason' }
  ];

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.adjustmentForm = this.fb.group({
      adjustmentDate: [today, [Validators.required]],
      warehouseId: [null, [Validators.required]],
      reason: ['STOCK_COUNT' as AdjustmentReason, [Validators.required]],
      adjustmentAccountId: [null, [Validators.required]],
      notes: [''],
      lines: this.fb.array([])
    });

    this.adjustmentForm.get('warehouseId')?.valueChanges.subscribe(whId => {
      this.onWarehouseChange(whId);
    });

    this.adjustmentForm.get('adjustmentAccountId')?.valueChanges.subscribe(() => {
      this.recalculateAll();
    });

    this.linesArray.valueChanges.subscribe(() => {
      this.recalculateAll();
    });
  }

  get linesArray(): FormArray {
    return this.adjustmentForm.get('lines') as FormArray;
  }

  private loadDependencies(): void {
    this.loading = true;

    // 1. Warehouses
    this.inventoryService.getWarehouses().subscribe({
      next: whs => {
        this.warehouses = whs;
        const defaultWh = whs.find(w => w.isDefault) || (whs.length > 0 ? whs[0] : null);
        if (defaultWh) {
          this.adjustmentForm.patchValue({ warehouseId: defaultWh.id });
        }
      }
    });

    // 2. Expense / Adjustment Accounts
    this.accountService.getAccounts(0, 200).subscribe({
      next: page => {
        this.expenseAccounts = page.content.filter(
          a => a.accountType === 'EXPENSE' || a.code === '5150' || a.code === '5200'
        );
        // Default to 5150 Inventory Adjustments or first expense
        const defaultAdj = this.expenseAccounts.find(a => a.code === '5150' || a.name.includes('Adjustment')) ||
          (this.expenseAccounts.length > 0 ? this.expenseAccounts[0] : null);
        if (defaultAdj) {
          this.adjustmentForm.patchValue({ adjustmentAccountId: defaultAdj.id });
        }
      }
    });

    // 3. Catalog Items (for dropdown search)
    this.inventoryService.getItems({ itemType: 'INVENTORY', active: true, size: 500 }).subscribe({
      next: page => {
        this.catalogItems = page.content;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  onWarehouseChange(warehouseId: number): void {
    // Refresh system quantities and unit costs for current lines
    if (!warehouseId) return;

    this.inventoryService.getStockBalances(warehouseId).subscribe({
      next: balances => {
        const balMap = new Map<number, StockBalance>(balances.map(b => [b.itemId, b]));
        for (let i = 0; i < this.linesArray.length; i++) {
          const group = this.linesArray.at(i) as FormGroup;
          const itemId = group.get('itemId')?.value;
          const bal = balMap.get(itemId);
          const sysQty = bal ? bal.qtyOnHand : 0;
          const cost = bal && bal.avgCost > 0 ? bal.avgCost : (this.findCatalogItem(itemId)?.purchasePrice || 0);

          group.patchValue({
            systemQty: sysQty,
            unitCost: cost
          }, { emitEvent: false });
        }
        this.recalculateAll();
      }
    });
  }

  loadEntireWarehouse(): void {
    const whId = this.adjustmentForm.get('warehouseId')?.value;
    if (!whId) {
      this.notificationService.warning('Please select a warehouse first.');
      return;
    }

    this.loadingWarehouseStock = true;
    this.inventoryService.getStockBalances(whId).subscribe({
      next: balances => {
        this.linesArray.clear();

        for (const bal of balances) {
          const item = this.findCatalogItem(bal.itemId);
          this.linesArray.push(
            this.createLineGroup({
              itemId: bal.itemId,
              sku: bal.itemSku || item?.sku || '',
              name: bal.itemName || item?.name || '',
              systemQty: bal.qtyOnHand,
              countedQty: bal.qtyOnHand,
              unitCost: bal.avgCost > 0 ? bal.avgCost : (item?.purchasePrice || 0)
            })
          );
        }

        this.loadingWarehouseStock = false;
        this.notificationService.success(`Loaded ${balances.length} items from selected warehouse.`);
        this.recalculateAll();
      },
      error: () => {
        this.notificationService.error('Failed to load warehouse stock balances.');
        this.loadingWarehouseStock = false;
      }
    });
  }

  addItemFromSelect(): void {
    if (!this.selectedItemId) return;
    this.addItemById(this.selectedItemId);
    this.selectedItemId = null;
  }

  scanBarcode(): void {
    if (!this.barcodeInput.trim()) return;
    const code = this.barcodeInput.trim().toUpperCase();

    const item = this.catalogItems.find(
      i => (i.barcode && i.barcode.toUpperCase() === code) || i.sku.toUpperCase() === code
    );

    if (item) {
      this.addItemById(item.id);
      this.barcodeInput = '';
    } else {
      this.notificationService.error(`Item with barcode/SKU "${code}" not found.`);
    }
  }

  private addItemById(itemId: number): void {
    // Check if already in lines
    for (let i = 0; i < this.linesArray.length; i++) {
      if (this.linesArray.at(i).get('itemId')?.value === itemId) {
        this.notificationService.info('Item is already in the adjustment lines.');
        return;
      }
    }

    const item = this.findCatalogItem(itemId);
    if (!item) return;

    const whId = this.adjustmentForm.get('warehouseId')?.value;
    if (whId) {
      this.inventoryService.getStockBalance(itemId, whId).subscribe({
        next: bal => {
          this.linesArray.push(
            this.createLineGroup({
              itemId: item.id,
              sku: item.sku,
              name: item.name,
              systemQty: bal.qtyOnHand,
              countedQty: bal.qtyOnHand,
              unitCost: bal.avgCost > 0 ? bal.avgCost : item.purchasePrice
            })
          );
          this.recalculateAll();
        },
        error: () => {
          // If 0 balance record exists
          this.linesArray.push(
            this.createLineGroup({
              itemId: item.id,
              sku: item.sku,
              name: item.name,
              systemQty: 0,
              countedQty: 0,
              unitCost: item.purchasePrice
            })
          );
          this.recalculateAll();
        }
      });
    } else {
      this.linesArray.push(
        this.createLineGroup({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          systemQty: 0,
          countedQty: 0,
          unitCost: item.purchasePrice
        })
      );
      this.recalculateAll();
    }
  }

  private createLineGroup(data: {
    itemId: number;
    sku: string;
    name: string;
    systemQty: number;
    countedQty: number;
    unitCost: number;
  }): FormGroup {
    return this.fb.group({
      itemId: [data.itemId, Validators.required],
      sku: [data.sku],
      name: [data.name],
      systemQty: [data.systemQty],
      countedQty: [data.countedQty, [Validators.required, Validators.min(0)]],
      unitCost: [data.unitCost, [Validators.required, Validators.min(0)]]
    });
  }

  removeLine(index: number): void {
    this.linesArray.removeAt(index);
    this.recalculateAll();
  }

  getDifferenceQty(index: number): number {
    return this.lineSummaries[index]?.differenceQty ?? 0;
  }

  getValueImpact(index: number): number {
    return this.lineSummaries[index]?.valueImpact ?? 0;
  }

  recalculateAll(): void {
    this.lineSummaries = [];
    this.totalShortageValue = 0;
    this.totalSurplusValue = 0;

    for (let i = 0; i < this.linesArray.length; i++) {
      const g = this.linesArray.at(i).value;
      const sysQty = Number(g.systemQty || 0);
      const cntQty = Number(g.countedQty || 0);
      const cost = Number(g.unitCost || 0);

      const diff = cntQty - sysQty;
      const impact = diff * cost;

      if (diff < 0) {
        this.totalShortageValue += Math.abs(impact);
      } else if (diff > 0) {
        this.totalSurplusValue += impact;
      }

      this.lineSummaries.push({
        itemId: g.itemId,
        sku: g.sku,
        name: g.name,
        systemQty: sysQty,
        countedQty: cntQty,
        differenceQty: diff,
        unitCost: cost,
        valueImpact: impact
      });
    }

    this.netValueImpact = this.totalSurplusValue - this.totalShortageValue;
    this.generateJournalPreview();
  }

  private generateJournalPreview(): void {
    this.journalPreview = [];

    const adjAccId = this.adjustmentForm.get('adjustmentAccountId')?.value;
    const adjAccount = this.expenseAccounts.find(a => a.id === adjAccId);
    const adjName = adjAccount ? `${adjAccount.code} - ${adjAccount.name}` : 'Inventory Adjustments';

    // Shortage journal: Dr Adjustment Expense, Cr Inventory (1300)
    if (this.totalShortageValue > 0) {
      this.journalPreview.push({
        accountCode: adjAccount?.code || '5150',
        accountName: `${adjName} (Shortage/Loss)`,
        debit: this.totalShortageValue,
        credit: 0
      });
      this.journalPreview.push({
        accountCode: '1300',
        accountName: '1300 - Merchandise Inventory',
        debit: 0,
        credit: this.totalShortageValue
      });
    }

    // Surplus journal: Dr Inventory (1300), Cr Adjustment Expense
    if (this.totalSurplusValue > 0) {
      this.journalPreview.push({
        accountCode: '1300',
        accountName: '1300 - Merchandise Inventory',
        debit: this.totalSurplusValue,
        credit: 0
      });
      this.journalPreview.push({
        accountCode: adjAccount?.code || '5150',
        accountName: `${adjName} (Surplus Offset)`,
        debit: 0,
        credit: this.totalSurplusValue
      });
    }
  }

  private findCatalogItem(itemId: number): Item | undefined {
    return this.catalogItems.find(i => i.id === itemId);
  }

  saveDraft(): void {
    if (this.adjustmentForm.invalid || this.linesArray.length === 0) {
      this.adjustmentForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields and add at least one line.');
      return;
    }

    this.saving = true;
    const req = this.buildRequest();

    this.inventoryService.createAdjustment(req).subscribe({
      next: res => {
        this.saving = false;
        this.notificationService.success(`Draft stock adjustment ${res.adjustmentNo} saved successfully.`);
        this.router.navigate(['/inventory/items']);
      },
      error: () => (this.saving = false)
    });
  }

  saveAndPost(): void {
    if (this.adjustmentForm.invalid || this.linesArray.length === 0) {
      this.adjustmentForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields and add at least one line.');
      return;
    }

    this.posting = true;
    const req = this.buildRequest();

    this.inventoryService.createAdjustment(req).subscribe({
      next: draft => {
        this.inventoryService.postAdjustment(draft.id).subscribe({
          next: posted => {
            this.posting = false;
            this.notificationService.success(
              `Stock adjustment ${posted.adjustmentNo} posted to General Ledger successfully.`
            );
            this.router.navigate(['/inventory/items']);
          },
          error: () => (this.posting = false)
        });
      },
      error: () => (this.posting = false)
    });
  }

  private buildRequest(): StockAdjustmentRequest {
    const val = this.adjustmentForm.value;
    return {
      adjustmentDate: val.adjustmentDate,
      warehouseId: val.warehouseId,
      reason: val.reason,
      adjustmentAccountId: val.adjustmentAccountId,
      notes: val.notes,
      lines: val.lines.map((l: any) => ({
        itemId: l.itemId,
        countedQty: l.countedQty,
        unitCost: l.unitCost
      }))
    };
  }
}
