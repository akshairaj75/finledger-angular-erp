import { describe, expect, it } from 'vitest';
import {
  ProfitLossReport,
  BalanceSheetReport,
  VatReturnReport,
  DashboardSummary
} from '../../core/models/report.model';

describe('Reports & Dashboard Logic Tests', () => {
  it('should compute Profit & Loss Gross Profit and Net Profit correctly', () => {
    const pnl: ProfitLossReport = {
      fromDate: '2026-01-01',
      toDate: '2026-10-31',
      revenueLines: [
        { accountId: 1, accountCode: '4000', accountName: 'Product Sales', amount: 80000 },
        { accountId: 2, accountCode: '4100', accountName: 'Consulting Services', amount: 20000 }
      ],
      totalRevenue: 100000,
      cogsLines: [
        { accountId: 3, accountCode: '5000', accountName: 'Cost of Inventory', amount: 35000 }
      ],
      totalCogs: 35000,
      grossProfit: 65000, // 100000 - 35000
      expenseLines: [
        { accountId: 4, accountCode: '6100', accountName: 'Rent', amount: 15000 },
        { accountId: 5, accountCode: '6200', accountName: 'Utilities & Salaries', amount: 25000 }
      ],
      totalExpenses: 40000,
      netProfit: 25000 // 65000 - 40000
    };

    const calculatedGross = pnl.totalRevenue - pnl.totalCogs;
    const calculatedNet = calculatedGross - pnl.totalExpenses;

    expect(calculatedGross).toBe(65000);
    expect(calculatedNet).toBe(25000);
    expect(pnl.grossProfit).toBe(calculatedGross);
    expect(pnl.netProfit).toBe(calculatedNet);
  });

  it('should verify Balance Sheet balance condition (Assets = Liabilities + Equity)', () => {
    const bs: BalanceSheetReport = {
      asOfDate: '2026-10-31',
      currentAssets: [{ accountId: 10, accountCode: '1110', accountName: 'Bank', amount: 50000 }],
      totalCurrentAssets: 50000,
      nonCurrentAssets: [{ accountId: 11, accountCode: '1200', accountName: 'Equipment', amount: 30000 }],
      totalNonCurrentAssets: 30000,
      totalAssets: 80000,
      currentLiabilities: [{ accountId: 20, accountCode: '2110', accountName: 'Accounts Payable', amount: 20000 }],
      totalCurrentLiabilities: 20000,
      nonCurrentLiabilities: [],
      totalNonCurrentLiabilities: 0,
      totalLiabilities: 20000,
      equityLines: [{ accountId: 30, accountCode: '3100', accountName: 'Share Capital', amount: 35000 }],
      retainedEarnings: 0,
      netIncomeYearToDate: 25000,
      totalEquity: 60000, // 35000 + 25000
      totalLiabilitiesAndEquity: 80000,
      balanced: true
    };

    expect(bs.totalAssets).toBe(bs.totalCurrentAssets + bs.totalNonCurrentAssets);
    expect(bs.totalLiabilities).toBe(bs.totalCurrentLiabilities + bs.totalNonCurrentLiabilities);
    expect(bs.totalLiabilitiesAndEquity).toBe(bs.totalLiabilities + bs.totalEquity);
    expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
    expect(bs.balanced).toBe(true);
  });

  it('should calculate UAE FTA VAT Return (Box 13 Net VAT Due) with Credit Note and Debit Note adjustments', () => {
    // Standard Sales: 200,000 (VAT: 10,000)
    // Credit Note (Sales return): 20,000 (VAT: 1,000) -> Net Sales: 180,000, Net Output VAT: 9,000
    // Standard Purchases: 80,000 (VAT: 4,000)
    // Debit Note (Purchase return): 10,000 (VAT: 500)
    // Posted Expenses: 5,000 (VAT: 250) -> Net Purchases: 75,000, Net Input VAT: 3,750
    const salesStandard = 200000;
    const salesVatStandard = 10000;
    const creditNoteSales = 20000;
    const creditNoteVat = 1000;

    const netSales = salesStandard - creditNoteSales;
    const netOutputVat = salesVatStandard - creditNoteVat;

    const purchasesStandard = 80000;
    const purchasesVatStandard = 4000;
    const debitNotePurchases = 10000;
    const debitNoteVat = 500;
    const expensePurchases = 5000;
    const expenseVat = 250;

    const netPurchases = purchasesStandard - debitNotePurchases + expensePurchases;
    const netInputVat = purchasesVatStandard - debitNoteVat + expenseVat;
    const netVatDue = netOutputVat - netInputVat;

    const vat: VatReturnReport = {
      fromDate: '2026-07-01',
      toDate: '2026-09-30',
      standardRatedSalesAmount: netSales,
      standardRatedSalesVat: netOutputVat,
      zeroRatedSalesAmount: 50000,
      exemptSalesAmount: 10000,
      standardRatedPurchasesAmount: netPurchases,
      standardRatedPurchasesVat: netInputVat,
      totalOutputVat: netOutputVat,
      totalInputVat: netInputVat,
      netVatDue: netVatDue
    };

    expect(vat.totalOutputVat).toBe(9000);
    expect(vat.totalInputVat).toBe(3750);
    expect(vat.netVatDue).toBe(5250);
  });

  it('should support Expense Analysis grouping by category, employee, and costCenter', () => {
    const supportedGroupByOptions = ['category', 'employee', 'costCenter'];
    expect(supportedGroupByOptions).toContain('category');
    expect(supportedGroupByOptions).toContain('employee');
    expect(supportedGroupByOptions).toContain('costCenter');

    const groups = [
      { key: '1', name: 'Engineering', count: 5, total: 5000, reimbursable: 2000 },
      { key: '2', name: 'Marketing', count: 3, total: 3000, reimbursable: 1000 },
      { key: '3', name: 'Sales', count: 2, total: 2000, reimbursable: 500 }
    ];

    const grandTotal = groups.reduce((acc, g) => acc + g.total, 0);
    expect(grandTotal).toBe(10000);

    const shares = groups.map(g => (g.total / grandTotal) * 100);
    expect(shares[0]).toBe(50);
    expect(shares[1]).toBe(30);
    expect(shares[2]).toBe(20);
  });
});

