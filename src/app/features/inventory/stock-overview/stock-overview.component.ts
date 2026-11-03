import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

  stockList: StockSummary[] = [];
  filteredList: StockSummary[] = [];
  warehouses: Warehouse[] = [];
  categories: ItemCategory[] = [];

  loading = true;
  searchTerm = '';
  selectedWarehouseId: number | null = null;
  selectedCategoryId: number | null = null;
  selectedStatus = 'ALL';

  // Item Movements Drawer / Modal State
  selectedItem: StockSummary | null = null;
  movements: StockMovement[] = [];
  loadingMovements = false;
  movementsFromDate = '';
  movementsToDate = '';

  // KPI Metrics
  kpis = {
    totalStockValue: 0,
    activeSkus: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  };

  ngOnInit(): void {
    this.loadDependencies();
    this.loadStockSummary();
  }

  loadDependencies(): void {
    this.inventoryService.getWarehouses().subscribe({
      next: whs => (this.warehouses = whs),
      error: () => this.notificationService.error('Failed to load warehouses')
    });

    this.inventoryService.getCategories().subscribe({
      next: cats => (this.categories = cats),
      error: () => this.notificationService.error('Failed to load item categories')
    });
  }

  loadStockSummary(): void {
    this.loading = true;
    this.inventoryService
      .getStockSummary(
        this.selectedCategoryId ?? undefined,
        this.selectedWarehouseId ?? undefined,
        this.selectedStatus
      )
      .subscribe({
        next: data => {
          this.stockList = data;
          this.calculateKpis(data);
          this.applyClientFilters();
          this.loading = false;
        },
        error: () => {
          this.notificationService.error('Failed to load stock summary');
          this.loading = false;
        }
      });
  }

  calculateKpis(items: StockSummary[]): void {
    this.kpis.totalStockValue = items.reduce((sum, item) => sum + (item.totalStockValue || 0), 0);
    this.kpis.activeSkus = items.length;
    this.kpis.lowStockCount = items.filter(i => i.status === 'LOW_STOCK').length;
    this.kpis.outOfStockCount = items.filter(i => i.status === 'OUT_OF_STOCK').length;
  }

  applyClientFilters(): void {
    if (!this.searchTerm.trim()) {
      this.filteredList = [...this.stockList];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredList = this.stockList.filter(
      item =>
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(term))
    );
  }

  onFilterChange(): void {
    this.loadStockSummary();
  }

  onStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.loadStockSummary();
  }

  onSearch(): void {
    this.applyClientFilters();
  }

  openLedger(item: StockSummary): void {
    this.selectedItem = item;
    this.movements = [];
    this.loadingMovements = true;

    this.inventoryService
      .getItemMovements(
        item.itemId,
        this.selectedWarehouseId ?? undefined,
        this.movementsFromDate || undefined,
        this.movementsToDate || undefined
      )
      .subscribe({
        next: movs => {
          this.movements = movs;
          this.loadingMovements = false;
        },
        error: () => {
          this.notificationService.error(`Failed to load movements for ${item.sku}`);
          this.loadingMovements = false;
        }
      });
  }

  closeLedger(): void {
    this.selectedItem = null;
    this.movements = [];
  }

  filterLedgerDates(): void {
    if (this.selectedItem) {
      this.openLedger(this.selectedItem);
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

