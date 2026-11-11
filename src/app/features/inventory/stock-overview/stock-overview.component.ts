import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ItemCategory, StockMovement, StockSummary, Warehouse } from '../../../core/models/inventory.model';
import { NotificationService } from '../../../core/services/notification.service';
import { InventoryService } from '../services/inventory.service';

@Component({
  selector: 'app-stock-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './stock-overview.component.html',
  styleUrls: ['./stock-overview.component.css']
})
export class StockOverviewComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private notificationService = inject(NotificationService);

  stockList = signal<StockSummary[]>([]);
  filteredList = signal<StockSummary[]>([]);
  warehouses = signal<Warehouse[]>([]);
  categories = signal<ItemCategory[]>([]);

  loading = signal(true);
  searchTerm = signal('');
  selectedWarehouseId = signal<number | null>(null);
  selectedCategoryId = signal<number | null>(null);
  selectedStatus = signal('ALL');

  // Item Movements Drawer / Modal State
  selectedItem = signal<StockSummary | null>(null);
  movements = signal<StockMovement[]>([]);
  loadingMovements = signal(false);
  movementsFromDate = signal('');
  movementsToDate = signal('');

  // KPI Metrics
  kpis = computed(() => {
    const items = this.stockList();
    return {
      totalStockValue: items.reduce((sum, item) => sum + (item.totalStockValue || 0), 0),
      activeSkus: items.length,
      lowStockCount: items.filter(i => i.status === 'LOW_STOCK').length,
      outOfStockCount: items.filter(i => i.status === 'OUT_OF_STOCK').length
    };
  });

  ngOnInit(): void {
    this.loadDependencies();
    this.loadStockSummary();
  }

  loadDependencies(): void {
    this.inventoryService.getWarehouses().subscribe({
      next: whs => this.warehouses.set(whs),
      error: () => this.notificationService.error('Failed to load warehouses')
    });

    this.inventoryService.getCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => this.notificationService.error('Failed to load item categories')
    });
  }

  loadStockSummary(): void {
    this.loading.set(true);
    this.inventoryService
      .getStockSummary(
        this.selectedCategoryId() ?? undefined,
        this.selectedWarehouseId() ?? undefined,
        this.selectedStatus()
      )
      .subscribe({
        next: data => {
          this.stockList.set(data);
          this.applyClientFilters();
          this.loading.set(false);
        },
        error: () => {
          this.notificationService.error('Failed to load stock summary');
          this.loading.set(false);
        }
      });
  }

  applyClientFilters(): void {
    const list = this.stockList();
    const rawTerm = this.searchTerm().trim();
    if (!rawTerm) {
      this.filteredList.set([...list]);
      return;
    }

    const term = rawTerm.toLowerCase();
    this.filteredList.set(list.filter(
      item =>
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(term))
    ));
  }

  onFilterChange(): void {
    this.loadStockSummary();
  }

  onStatusFilter(status: string): void {
    this.selectedStatus.set(status);
    this.loadStockSummary();
  }

  onSearch(): void {
    this.applyClientFilters();
  }

  openLedger(item: StockSummary): void {
    this.selectedItem.set(item);
    this.movements.set([]);
    this.loadingMovements.set(true);

    this.inventoryService
      .getItemMovements(
        item.itemId,
        this.selectedWarehouseId() ?? undefined,
        this.movementsFromDate() || undefined,
        this.movementsToDate() || undefined
      )
      .subscribe({
        next: movs => {
          this.movements.set(movs);
          this.loadingMovements.set(false);
        },
        error: () => {
          this.notificationService.error(`Failed to load movements for ${item.sku}`);
          this.loadingMovements.set(false);
        }
      });
  }

  closeLedger(): void {
    this.selectedItem.set(null);
    this.movements.set([]);
  }

  filterLedgerDates(): void {
    const current = this.selectedItem();
    if (current) {
      this.openLedger(current);
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'IN_STOCK':
        return 'badge-success';
      case 'LOW_STOCK':
        return 'badge-warning';
      case 'OUT_OF_STOCK':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'IN_STOCK':
        return 'In Stock';
      case 'LOW_STOCK':
        return 'Low Stock';
      case 'OUT_OF_STOCK':
        return 'Out of Stock';
      default:
        return status;
    }
  }

  getMovementBadgeClass(type: string): string {
    if (type.includes('PURCHASE') || type.includes('IN') || type === 'OPENING') {
      return 'badge-in';
    }
    return 'badge-out';
  }

  getWarehouseEntries(whMap: Record<string, number>): [string, number][] {
    return Object.entries(whMap || {});
  }
}

