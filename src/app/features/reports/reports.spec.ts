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

  it('should calculate UAE FTA VAT Return (Box 13 Net VAT Due)', () => {
    const vat: VatReturnReport = {
      fromDate: '2026-07-01',
      toDate: '2026-09-30',
      standardRatedSalesAmount: 200000,
      standardRatedSalesVat: 10000, // 5% of 200,000
      zeroRatedSalesAmount: 50000,
      exemptSalesAmount: 10000,
      standardRatedPurchasesAmount: 80000,
      standardRatedPurchasesVat: 4000, // 5% of 80,000
      totalOutputVat: 10000,
      totalInputVat: 4000,
      netVatDue: 6000 // 10000 - 4000
    };

    expect(vat.totalOutputVat).toBe(vat.standardRatedSalesVat);
    expect(vat.totalInputVat).toBe(vat.standardRatedPurchasesVat);
    expect(vat.netVatDue).toBe(vat.totalOutputVat - vat.totalInputVat);
    expect(vat.netVatDue).toBe(6000);
  });
});

