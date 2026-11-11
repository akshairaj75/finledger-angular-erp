import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Item,
  StockBalance,
  StockTransfer,
  StockTransferRequest,
  Warehouse
} from '../../../core/models/inventory.model';
import { NotificationService } from '../../../core/services/notification.service';
import { InventoryService } from '../services/inventory.service';

export interface TransferLineSummary {
  itemId: number;
  sku: string;
  name: string;
  availableQty: number;
  transferQty: number;
  unitCost: number;
  totalCost: number;
  isOverAvailable: boolean;
}

@Component({
  selector: 'app-stock-transfer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './stock-transfer-form.component.html',
  styleUrls: ['./stock-transfer-form.component.css']
})
export class StockTransferFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private inventoryService = inject(InventoryService);
  private notificationService = inject(NotificationService);

  transferForm!: FormGroup;

  warehouses = signal<Warehouse[]>([]);
  catalogItems = signal<Item[]>([]);
  sourceBalances = signal<Map<number, StockBalance>>(new Map());

  loading = signal(true);
  saving = signal(false);
  dispatching = signal(false);

  // Live Summary
  lineSummaries = signal<TransferLineSummary[]>([]);
  totalTransferValue = signal(0);
  totalItemsCount = signal(0);
  hasInsufficientStock = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.transferForm = this.fb.group({
      transferDate: [today, [Validators.required]],
      fromWarehouseId: [null, [Validators.required]],
      toWarehouseId: [null, [Validators.required]],
      notes: [''],
      lines: this.fb.array([])
    });

    // When fromWarehouseId changes, reload balances for the source warehouse
    this.transferForm.get('fromWarehouseId')?.valueChanges.subscribe(whId => {
      this.onSourceWarehouseChange(whId);
    });

    this.linesArray.valueChanges.subscribe(() => {
      this.recalculateAll();
    });
  }

  get linesArray(): FormArray {
    return this.transferForm.get('lines') as FormArray;
  }

  private loadDependencies(): void {
    this.loading.set(true);

    // 1. Warehouses
    this.inventoryService.getWarehouses().subscribe({
      next: whs => {
        this.warehouses.set(whs);
        if (whs.length >= 2) {
          this.transferForm.patchValue({
            fromWarehouseId: whs[0].id,
            toWarehouseId: whs[1].id
          });
        }
      }
    });

    // 2. Catalog Items
    this.inventoryService.getItems({ itemType: 'INVENTORY', active: true, size: 500 }).subscribe({
      next: page => {
        this.catalogItems.set(page.content);
        this.loading.set(false);
        // Start with one empty line
        this.addLine();
      },
      error: () => this.loading.set(false)
    });
  }

  onSourceWarehouseChange(whId: number): void {
    if (!whId) return;

    this.inventoryService.getStockBalances(whId).subscribe({
      next: bals => {
        this.sourceBalances.set(new Map(bals.map(b => [b.itemId, b])));
        this.updateLineSourceQuantities();
        this.recalculateAll();
      }
    });
  }

  private updateLineSourceQuantities(): void {
    const balances = this.sourceBalances();
    for (let i = 0; i < this.linesArray.length; i++) {
      const g = this.linesArray.at(i) as FormGroup;
      const itemId = g.get('itemId')?.value;
      if (itemId) {
        const bal = balances.get(itemId);
        g.patchValue({
          availableQty: bal ? bal.qtyOnHand : 0,
          unitCost: bal && bal.avgCost > 0 ? bal.avgCost : (this.findCatalogItem(itemId)?.purchasePrice || 0)
        }, { emitEvent: false });
      }
    }
  }

  createLineGroup(): FormGroup {
    return this.fb.group({
      itemId: [null, [Validators.required]],
      availableQty: [0],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitCost: [0]
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLineGroup());
    this.recalculateAll();
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
      this.recalculateAll();
    } else {
      this.notificationService.warning('At least one transfer line is required.');
    }
  }

  onItemSelect(index: number, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const itemId = Number(target.value);
    const item = this.findCatalogItem(itemId);
    const group = this.linesArray.at(index) as FormGroup;

    if (item) {
      const bal = this.sourceBalances().get(itemId);
      const avail = bal ? bal.qtyOnHand : 0;
      const cost = bal && bal.avgCost > 0 ? bal.avgCost : item.purchasePrice;

      group.patchValue({
        availableQty: avail,
        unitCost: cost
      });
    }

    this.recalculateAll();
  }

  recalculateAll(): void {
    const summaries: TransferLineSummary[] = [];
    let totalVal = 0;
    let totalCount = 0;
    let overStock = false;

    for (let i = 0; i < this.linesArray.length; i++) {
      const g = this.linesArray.at(i).value;
      const itemId = Number(g.itemId);
      const item = this.findCatalogItem(itemId);

      const qty = Number(g.quantity || 0);
      const avail = Number(g.availableQty || 0);
      const cost = Number(g.unitCost || 0);
      const lineCost = qty * cost;

      const isOver = qty > avail;
      if (isOver) {
        overStock = true;
      }

      totalVal += lineCost;
      totalCount += qty;

      summaries.push({
        itemId,
        sku: item ? item.sku : '',
        name: item ? item.name : '',
        availableQty: avail,
        transferQty: qty,
        unitCost: cost,
        totalCost: lineCost,
        isOverAvailable: isOver
      });
    }

    this.lineSummaries.set(summaries);
    this.totalTransferValue.set(totalVal);
    this.totalItemsCount.set(totalCount);
    this.hasInsufficientStock.set(overStock);
  }

  isLineOverAvailable(index: number): boolean {
    return !!this.lineSummaries()[index]?.isOverAvailable;
  }

  getLineAvailableQty(index: number): number {
    return this.lineSummaries()[index]?.availableQty ?? 0;
  }

  getLineTotalCost(index: number): number {
    return this.lineSummaries()[index]?.totalCost ?? 0;
  }

  saveDraft(): void {
    if (this.validateTransfer()) {
      this.saving.set(true);
      const req = this.buildRequest();

      this.inventoryService.createTransfer(req).subscribe({
        next: res => {
          this.saving.set(false);
          this.notificationService.success(`Draft stock transfer ${res.transferNo} created successfully.`);
          this.router.navigate(['/inventory/items']);
        },
        error: () => this.saving.set(false)
      });
    }
  }

  saveAndDispatch(): void {
    if (this.validateTransfer()) {
      this.dispatching.set(true);
      const req = this.buildRequest();

      this.inventoryService.createTransfer(req).subscribe({
        next: draft => {
          this.inventoryService.dispatchTransfer(draft.id).subscribe({
            next: dispatched => {
              this.dispatching.set(false);
              this.notificationService.success(
                `Stock transfer ${dispatched.transferNo} dispatched successfully. Stock moved to in-transit.`
              );
              this.router.navigate(['/inventory/items']);
            },
            error: () => this.dispatching.set(false)
          });
        },
        error: () => this.dispatching.set(false)
      });
    }
  }

  private validateTransfer(): boolean {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields.');
      return false;
    }

    const fromWh = this.transferForm.get('fromWarehouseId')?.value;
    const toWh = this.transferForm.get('toWarehouseId')?.value;

    if (fromWh === toWh) {
      this.notificationService.error('Source and Destination warehouses must be different.');
      return false;
    }

    if (this.linesArray.length === 0) {
      this.notificationService.error('At least one transfer line is required.');
      return false;
    }

    if (this.hasInsufficientStock()) {
      this.notificationService.error('One or more items exceed available quantity in the source warehouse.');
      return false;
    }

    return true;
  }

  private buildRequest(): StockTransferRequest {
    const val = this.transferForm.value;
    return {
      transferDate: val.transferDate,
      fromWarehouseId: val.fromWarehouseId,
      toWarehouseId: val.toWarehouseId,
      notes: val.notes,
      lines: val.lines.map((l: any) => ({
        itemId: Number(l.itemId),
        quantity: Number(l.quantity)
      }))
    };
  }

  private findCatalogItem(itemId: number): Item | undefined {
    return this.catalogItems().find(i => i.id === itemId);
  }
}
