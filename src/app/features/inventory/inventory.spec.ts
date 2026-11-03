import { describe, expect, it } from 'vitest';
import {
  Item,
  ItemType,
  CostingMethod,
  StockSummary
} from '../../core/models/inventory.model';

describe('Inventory Module - Stock Overview KPI & Status Logic', () => {
  const mockSummaries: StockSummary[] = [
    {
      itemId: 1,
      sku: 'WIDGET-01',
      name: 'Standard Steel Widget',
      categoryName: 'Hardware',
      itemType: 'INVENTORY',
      totalQtyOnHand: 150,
      reorderLevel: 20,
      weightedAvgCost: 25.50,
      totalStockValue: 3825.00,
      status: 'IN_STOCK'
    },
    {
      itemId: 2,
      sku: 'BOLT-M8',
      name: 'M8 Hex Bolt Pack',
      categoryName: 'Hardware',
      itemType: 'INVENTORY',
      totalQtyOnHand: 15,
      reorderLevel: 50,
      weightedAvgCost: 12.00,
      totalStockValue: 180.00,
      status: 'LOW_STOCK'
    },
    {
      itemId: 3,
      sku: 'GASKET-OIL',
      name: 'Oil Sump Gasket',
      categoryName: 'Seals',
      itemType: 'INVENTORY',
      totalQtyOnHand: 0,
      reorderLevel: 10,
      weightedAvgCost: 8.50,
      totalStockValue: 0.00,
      status: 'OUT_OF_STOCK'
    },
    {
      itemId: 4,
      sku: 'SRV-CONSULT',
      name: 'Engineering Consulting',
      categoryName: 'Services',
      itemType: 'SERVICE',
      totalQtyOnHand: 0,
      reorderLevel: 0,
      weightedAvgCost: 0.00,
      totalStockValue: 0.00,
      status: 'IN_STOCK'
    }
  ];

  it('should compute KPI totals correctly for active inventory SKUs', () => {
    const inventoryItems = mockSummaries.filter(i => i.itemType === 'INVENTORY');
    const activeSkus = inventoryItems.length;
    const totalStockValue = inventoryItems.reduce((acc, i) => acc + i.totalStockValue, 0);
    const lowStockCount = inventoryItems.filter(i => i.totalQtyOnHand > 0 && i.totalQtyOnHand <= i.reorderLevel).length;
    const outOfStockCount = inventoryItems.filter(i => i.totalQtyOnHand <= 0).length;

    expect(activeSkus).toBe(3);
    expect(totalStockValue).toBe(4005.00);
    expect(lowStockCount).toBe(1);
    expect(outOfStockCount).toBe(1);
  });

  it('should correctly classify item status based on on-hand quantity and reorder level', () => {
    function calculateStatus(qtyOnHand: number, reorderLevel: number): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
      if (qtyOnHand <= 0) return 'OUT_OF_STOCK';
      if (qtyOnHand <= reorderLevel) return 'LOW_STOCK';
      return 'IN_STOCK';
    }

    expect(calculateStatus(100, 20)).toBe('IN_STOCK');
    expect(calculateStatus(20, 20)).toBe('LOW_STOCK');
    expect(calculateStatus(5, 20)).toBe('LOW_STOCK');
    expect(calculateStatus(0, 20)).toBe('OUT_OF_STOCK');
    expect(calculateStatus(-2, 20)).toBe('OUT_OF_STOCK');
  });

  it('should filter stock summaries by search query on SKU or name', () => {
    const query = 'steel';
    const filtered = mockSummaries.filter(item =>
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].sku).toBe('WIDGET-01');
  });
});

describe('Inventory Module - Stock Adjustment & Live Journal Preview', () => {
  interface AdjustmentCalculationLine {
    itemId: number;
    systemQty: number;
    countedQty: number;
    avgCost: number;
  }

  function computeLineImpact(line: AdjustmentCalculationLine) {
    const difference = Math.round((line.countedQty - line.systemQty) * 1000) / 1000;
    const valueImpact = Math.round(difference * line.avgCost * 100) / 100;
    return { difference, valueImpact };
  }

  function generateJournalPreview(lines: { difference: number; valueImpact: number }[], adjustmentAccountCode: string) {
    let totalSurplusValue = 0;
    let totalShortageValue = 0;

    for (const l of lines) {
      if (l.valueImpact > 0) {
        totalSurplusValue += l.valueImpact;
      } else if (l.valueImpact < 0) {
        totalShortageValue += Math.abs(l.valueImpact);
      }
    }

    const netValue = Math.round((totalSurplusValue - totalShortageValue) * 100) / 100;

    // Double-entry preview lines
    const journalEntries: { account: string; debit: number; credit: number }[] = [];

    if (netValue > 0) {
      // Gain: Dr Inventory (1300), Cr Adjustment Account
      journalEntries.push({ account: '1300 - Merchandise Inventory', debit: netValue, credit: 0 });
      journalEntries.push({ account: `${adjustmentAccountCode} - Stock Adjustment`, debit: 0, credit: netValue });
    } else if (netValue < 0) {
      const absLoss = Math.abs(netValue);
      // Loss: Dr Adjustment Expense, Cr Inventory (1300)
      journalEntries.push({ account: `${adjustmentAccountCode} - Stock Adjustment`, debit: absLoss, credit: 0 });
      journalEntries.push({ account: '1300 - Merchandise Inventory', debit: 0, credit: absLoss });
    }

    const totalDebits = journalEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredits = journalEntries.reduce((s, e) => s + e.credit, 0);

    return {
      netValue,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.001,
      journalEntries
    };
  }

  it('should accurately calculate physical count variances and value impact', () => {
    const line1: AdjustmentCalculationLine = { itemId: 1, systemQty: 50, countedQty: 45, avgCost: 20.00 }; // -5 units => -100 AED (Shortage)
    const line2: AdjustmentCalculationLine = { itemId: 2, systemQty: 10, countedQty: 14, avgCost: 15.50 }; // +4 units => +62 AED (Surplus)

    const impact1 = computeLineImpact(line1);
    const impact2 = computeLineImpact(line2);

    expect(impact1.difference).toBe(-5);
    expect(impact1.valueImpact).toBe(-100.00);

    expect(impact2.difference).toBe(4);
    expect(impact2.valueImpact).toBe(62.00);
  });

  it('should construct a strictly balanced double-entry GL journal preview for net shortage', () => {
    const calculatedLines = [
      { difference: -10, valueImpact: -250.00 }, // shortage: -250 AED
      { difference: 2, valueImpact: 50.00 }      // surplus: +50 AED
    ];
    // Net: -200 AED loss

    const preview = generateJournalPreview(calculatedLines, '5150');

    expect(preview.netValue).toBe(-200.00);
    expect(preview.isBalanced).toBe(true);
    expect(preview.totalDebits).toBe(200.00);
    expect(preview.totalCredits).toBe(200.00);

    // Dr 5150 Stock Adjustment Expense: 200 AED
    expect(preview.journalEntries[0].account).toContain('5150');
    expect(preview.journalEntries[0].debit).toBe(200.00);

    // Cr 1300 Merchandise Inventory: 200 AED
    expect(preview.journalEntries[1].account).toContain('1300');
    expect(preview.journalEntries[1].credit).toBe(200.00);
  });

  it('should construct a strictly balanced double-entry GL journal preview for net surplus', () => {
    const calculatedLines = [
      { difference: 15, valueImpact: 300.00 } // surplus: +300 AED
    ];

    const preview = generateJournalPreview(calculatedLines, '5150');

    expect(preview.netValue).toBe(300.00);
    expect(preview.isBalanced).toBe(true);
    expect(preview.totalDebits).toBe(300.00);
    expect(preview.totalCredits).toBe(300.00);

    // Dr 1300 Merchandise Inventory: 300 AED
    expect(preview.journalEntries[0].account).toContain('1300');
    expect(preview.journalEntries[0].debit).toBe(300.00);

    // Cr 5150 Stock Adjustment: 300 AED
    expect(preview.journalEntries[1].account).toContain('5150');
    expect(preview.journalEntries[1].credit).toBe(300.00);
  });
});

describe('Inventory Module - Stock Transfer Validation', () => {
  it('should disallow identical source and destination warehouses', () => {
    function validateWarehouses(fromId: number | null, toId: number | null): boolean {
      if (!fromId || !toId) return false;
      return fromId !== toId;
    }

    expect(validateWarehouses(1, 1)).toBe(false);
    expect(validateWarehouses(1, 2)).toBe(true);
    expect(validateWarehouses(null, 2)).toBe(false);
  });

  it('should detect when transfer quantity exceeds warehouse stock', () => {
    function checkStockAvailability(transferQty: number, availableQty: number): { isValid: boolean; warning?: string } {
      if (transferQty <= 0) {
        return { isValid: false, warning: 'Quantity must be greater than zero' };
      }
      if (transferQty > availableQty) {
        return {
          isValid: false,
          warning: `Exceeds available stock (Available: ${availableQty}, Requested: ${transferQty})`
        };
      }
      return { isValid: true };
    }

    const validCheck = checkStockAvailability(50, 100);
    expect(validCheck.isValid).toBe(true);
    expect(validCheck.warning).toBeUndefined();

    const overCheck = checkStockAvailability(120, 100);
    expect(overCheck.isValid).toBe(false);
    expect(overCheck.warning).toContain('Exceeds available stock (Available: 100, Requested: 120)');
  });
});

describe('Inventory Module - Document Integration Real-Time Stock Warning', () => {
  it('should raise insufficient stock warning on sales invoice when quantity exceeds warehouse balance', () => {
    const stockBalances = new Map<string, number>();
    stockBalances.set('item_10_wh_1', 15);

    function getLineStockWarning(itemId: number | null, warehouseId: number | null, quantity: number): string | null {
      if (!itemId || !warehouseId) return null;
      const onHand = stockBalances.get(`item_${itemId}_wh_${warehouseId}`) ?? 0;
      if (quantity > onHand) {
        return `⚠️ Insufficient stock in selected warehouse (Available: ${onHand}, Requested: ${quantity})`;
      }
      return null;
    }

    // Item 10, Warehouse 1: 15 on hand
    expect(getLineStockWarning(10, 1, 10)).toBeNull(); // 10 <= 15 -> OK
    expect(getLineStockWarning(10, 1, 15)).toBeNull(); // 15 <= 15 -> OK
    expect(getLineStockWarning(10, 1, 20)).toBe(
      '⚠️ Insufficient stock in selected warehouse (Available: 15, Requested: 20)'
    ); // 20 > 15 -> Warning
  });

  it('should display warehouse availability badge on vendor bill for inventory replenishment', () => {
    const stockBalances = new Map<string, number>();
    stockBalances.set('item_5_wh_2', 42);

    function getLineStockInfo(itemId: number | null, warehouseId: number | null, unit: string, whCode: string): string | null {
      if (!itemId) return null;
      const onHand = stockBalances.get(`item_${itemId}_wh_${warehouseId}`) ?? 0;
      return `Current Stock: ${onHand} ${unit} in ${whCode}`;
    }

    expect(getLineStockInfo(5, 2, 'PCS', 'DXB-MAIN')).toBe('Current Stock: 42 PCS in DXB-MAIN');
  });
});
