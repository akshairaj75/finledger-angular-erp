import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Item,
  ItemCategory,
  ItemRequest,
  ReorderSuggestion,
  StockAdjustment,
  StockAdjustmentRequest,
  StockBalance,
  StockMovement,
  StockSummary,
  StockTransfer,
  StockTransferRequest,
  Warehouse
} from '../../../core/models/inventory.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);
  private apiPrefix = '/api/v1';

  // 1. Stock Summary & Reporting
  getStockSummary(categoryId?: number, warehouseId?: number, status?: string): Observable<StockSummary[]> {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId.toString());
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());
    if (status && status !== 'ALL') params = params.set('status', status);

    return this.http.get<StockSummary[]>(`${this.apiPrefix}/items/stock-summary`, { params });
  }

  getItemMovements(itemId: number, warehouseId?: number, from?: string, to?: string): Observable<StockMovement[]> {
    let params = new HttpParams();
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    return this.http.get<StockMovement[]>(`${this.apiPrefix}/items/${itemId}/movements`, { params });
  }

  getReorderSuggestions(): Observable<ReorderSuggestion[]> {
    return this.http.get<ReorderSuggestion[]>(`${this.apiPrefix}/items/reorder-suggestions`);
  }

  // 2. Items Catalog
  getItems(query?: {
    itemType?: string;
    categoryId?: number;
    active?: boolean;
    search?: string;
    page?: number;
    size?: number;
  }): Observable<Page<Item>> {
    let params = new HttpParams();
    if (query?.itemType) params = params.set('itemType', query.itemType);
    if (query?.categoryId) params = params.set('categoryId', query.categoryId.toString());
    if (query?.active !== undefined) params = params.set('active', query.active.toString());
    if (query?.search) params = params.set('search', query.search);
    if (query?.page !== undefined) params = params.set('page', query.page.toString());
    if (query?.size !== undefined) params = params.set('size', query.size.toString());

    return this.http.get<Page<Item>>(`${this.apiPrefix}/items`, { params });
  }

  getItemById(id: number): Observable<Item> {
    return this.http.get<Item>(`${this.apiPrefix}/items/${id}`);
  }

  createItem(request: ItemRequest): Observable<Item> {
    return this.http.post<Item>(`${this.apiPrefix}/items`, request);
  }

  updateItem(id: number, request: ItemRequest): Observable<Item> {
    return this.http.put<Item>(`${this.apiPrefix}/items/${id}`, request);
  }

  deleteItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiPrefix}/items/${id}`);
  }

  // 3. Warehouses
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.apiPrefix}/warehouses`);
  }

  createWarehouse(request: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${this.apiPrefix}/warehouses`, request);
  }

  // 4. Categories
  getCategories(): Observable<ItemCategory[]> {
    return this.http.get<ItemCategory[]>(`${this.apiPrefix}/item-categories`);
  }

  // 5. Stock Balances
  getStockBalances(warehouseId?: number): Observable<StockBalance[]> {
    let params = new HttpParams();
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());
    return this.http.get<StockBalance[]>(`${this.apiPrefix}/stock-balances`, { params });
  }

  getStockBalance(itemId: number, warehouseId: number): Observable<StockBalance> {
    return this.http.get<StockBalance>(`${this.apiPrefix}/stock-balances/${itemId}/${warehouseId}`);
  }

  // 6. Stock Adjustments
  getAdjustments(page = 0, size = 20): Observable<Page<StockAdjustment>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<StockAdjustment>>(`${this.apiPrefix}/stock-adjustments`, { params });
  }

  getAdjustmentById(id: number): Observable<StockAdjustment> {
    return this.http.get<StockAdjustment>(`${this.apiPrefix}/stock-adjustments/${id}`);
  }

  createAdjustment(request: StockAdjustmentRequest): Observable<StockAdjustment> {
    return this.http.post<StockAdjustment>(`${this.apiPrefix}/stock-adjustments`, request);
  }

  postAdjustment(id: number): Observable<StockAdjustment> {
    return this.http.post<StockAdjustment>(`${this.apiPrefix}/stock-adjustments/${id}/post`, {});
  }

  voidAdjustment(id: number, reason?: string): Observable<StockAdjustment> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.post<StockAdjustment>(`${this.apiPrefix}/stock-adjustments/${id}/void`, {}, { params });
  }

  // 7. Stock Transfers
  getTransfers(page = 0, size = 20): Observable<Page<StockTransfer>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<StockTransfer>>(`${this.apiPrefix}/stock-transfers`, { params });
  }

  getTransferById(id: number): Observable<StockTransfer> {
    return this.http.get<StockTransfer>(`${this.apiPrefix}/stock-transfers/${id}`);
  }

  createTransfer(request: StockTransferRequest): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(`${this.apiPrefix}/stock-transfers`, request);
  }

  dispatchTransfer(id: number): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(`${this.apiPrefix}/stock-transfers/${id}/dispatch`, {});
  }

  receiveTransfer(id: number): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(`${this.apiPrefix}/stock-transfers/${id}/receive`, {});
  }

  voidTransfer(id: number, reason?: string): Observable<StockTransfer> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.post<StockTransfer>(`${this.apiPrefix}/stock-transfers/${id}/void`, {}, { params });
  }
}

