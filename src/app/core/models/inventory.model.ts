export type ItemType = 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE';

export type CostingMethod = 'WEIGHTED_AVERAGE' | 'FIFO' | 'STANDARD';

export type MovementType =
  | 'OPENING'
  | 'PURCHASE'
  | 'SALE'
  | 'SALE_RETURN'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export type StockSourceType = 'INVOICE' | 'BILL' | 'ADJUSTMENT' | 'TRANSFER' | 'OPENING';

export type AdjustmentReason = 'STOCK_COUNT' | 'DAMAGED' | 'EXPIRED' | 'THEFT' | 'OPENING' | 'OTHER';

export type AdjustmentStatus = 'DRAFT' | 'POSTED' | 'VOID';

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'VOID';

export interface Item {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: number;
  categoryName?: string;
  itemType: ItemType;
  unit: string;
  costingMethod: CostingMethod;
  salesPrice: number;
  purchasePrice: number;
  reorderLevel: number;
  reorderQty: number;
  incomeAccountId?: number;
  cogsAccountId?: number;
  inventoryAccountId?: number;
  taxRateId?: number;
  imagePath?: string;
  isActive: boolean;
  totalOnHand?: number;
}

export interface ItemRequest {
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: number;
  itemType: ItemType;
  unit?: string;
  costingMethod?: CostingMethod;
  salesPrice?: number;
  purchasePrice?: number;
  reorderLevel?: number;
  reorderQty?: number;
  incomeAccountId?: number;
  cogsAccountId?: number;
  inventoryAccountId?: number;
  taxRateId?: number;
  imagePath?: string;
  isActive?: boolean;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address?: string;
  costCenterId?: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ItemCategory {
  id: number;
  name: string;
  parentId?: number;
  incomeAccountId?: number;
  inventoryAccountId?: number;
  cogsAccountId?: number;
}

export interface StockSummary {
  itemId: number;
  sku: string;
  name: string;
  categoryId?: number;
  categoryName?: string;
  itemType: ItemType;
  unit: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  avgCost: number;
  totalStockValue: number;
  reorderLevel: number;
  reorderQty: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  whQuantities: Record<string, number>;
}

export interface StockMovement {
  id: number;
  companyId: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  movementDate: string;
  movementType: MovementType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  balanceQty: number;
  sourceType: StockSourceType;
  sourceId: number;
  sourceLineId?: number;
  journalEntryId?: number;
  createdAt: string;
}

export interface StockBalance {
  id: number;
  itemId: number;
  itemSku?: string;
  itemName?: string;
  warehouseId: number;
  warehouseCode?: string;
  warehouseName?: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  avgCost: number;
  stockValue: number;
  updatedAt?: string;
}

export interface StockAdjustmentLineRequest {
  itemId: number;
  countedQty: number;
  unitCost?: number;
}

export interface StockAdjustmentRequest {
  adjustmentDate?: string;
  warehouseId: number;
  reason: AdjustmentReason;
  adjustmentAccountId: number;
  notes?: string;
  lines: StockAdjustmentLineRequest[];
}

export interface StockAdjustmentLine {
  id: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  unit: string;
  systemQty: number;
  countedQty: number;
  differenceQty: number;
  unitCost: number;
  differenceValue: number;
}

export interface StockAdjustment {
  id: number;
  companyId: number;
  adjustmentNo: string;
  adjustmentDate: string;
  warehouseId: number;
  warehouseCode?: string;
  warehouseName?: string;
  reason: AdjustmentReason;
  adjustmentAccountId: number;
  adjustmentAccountCode?: string;
  adjustmentAccountName?: string;
  notes?: string;
  totalValue: number;
  status: AdjustmentStatus;
  journalEntryId?: number;
  journalEntryNo?: string;
  lines: StockAdjustmentLine[];
}

export interface StockTransferLineRequest {
  itemId: number;
  quantity: number;
}

export interface StockTransferRequest {
  transferDate?: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  notes?: string;
  lines: StockTransferLineRequest[];
}

export interface StockTransferLine {
  id: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface StockTransfer {
  id: number;
  companyId: number;
  transferNo: string;
  transferDate: string;
  fromWarehouseId: number;
  fromWarehouseCode?: string;
  fromWarehouseName?: string;
  toWarehouseId: number;
  toWarehouseCode?: string;
  toWarehouseName?: string;
  status: TransferStatus;
  notes?: string;
  lines: StockTransferLine[];
}

export interface ReorderSuggestion {
  itemId: number;
  sku: string;
  name: string;
  unit: string;
  totalOnHand: number;
  reorderLevel: number;
  reorderQty: number;
  suggestedOrderQty: number;
  purchasePrice: number;
  estimatedCost: number;
}

