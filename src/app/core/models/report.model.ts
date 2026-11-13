export interface GeneralLedgerLine {
  date: string;
  entryNo: string;
  reference?: string;
  description?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerReport {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: GeneralLedgerLine[];
}

export interface ReportLine {
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
  compareAmount?: number;
  changePct?: number;
}

export interface ProfitLossReport {
  fromDate: string;
  toDate: string;
  comparePeriod?: string;
  revenueLines: ReportLine[];
  totalRevenue: number;
  totalRevenueCompare?: number;
  cogsLines: ReportLine[];
  totalCogs: number;
  totalCogsCompare?: number;
  grossProfit: number;
  grossProfitCompare?: number;
  expenseLines: ReportLine[];
  totalExpenses: number;
  totalExpensesCompare?: number;
  netProfit: number;
  netProfitCompare?: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  comparePeriod?: string;
  currentAssets: ReportLine[];
  totalCurrentAssets: number;
  nonCurrentAssets: ReportLine[];
  totalNonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: ReportLine[];
  totalCurrentLiabilities: number;
  nonCurrentLiabilities: ReportLine[];
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  equityLines: ReportLine[];
  retainedEarnings: number;
  netIncomeYearToDate: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export interface VatReturnReport {
  fromDate: string;
  toDate: string;
  standardRatedSalesAmount: number;
  standardRatedSalesVat: number;
  zeroRatedSalesAmount: number;
  exemptSalesAmount: number;
  standardRatedPurchasesAmount: number;
  standardRatedPurchasesVat: number;
  totalOutputVat: number;
  totalInputVat: number;
  netVatDue: number;
}

export interface StockValuationLine {
  itemId: number;
  sku: string;
  itemName: string;
  categoryName: string;
  warehouseName: string;
  quantityOnHand: number;
  unitCost: number;
  totalValue: number;
}

export interface StockValuationReport {
  asOfDate: string;
  warehouseId?: number;
  warehouseName?: string;
  lines: StockValuationLine[];
  totalValuation: number;
  totalItems: number;
}

export interface StockMovementLine {
  id: number;
  date: string;
  movementType: string;
  reference: string;
  warehouseName: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
  unitCost: number;
}

export interface StockMovementReport {
  itemId: number;
  sku: string;
  itemName: string;
  fromDate: string;
  toDate: string;
  openingQty: number;
  closingQty: number;
  movements: StockMovementLine[];
}

export interface PipelineStageSummary {
  stageId: number;
  stageName: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  probability: number;
}

export interface PipelineForecastReport {
  fromDate: string;
  toDate: string;
  ownerId?: number;
  stages: PipelineStageSummary[];
  totalPipelineValue: number;
  totalWeightedValue: number;
  totalDeals: number;
}

export interface ExpenseAnalysisGroup {
  groupKey: string;
  groupName: string;
  claimCount: number;
  totalAmount: number;
  reimbursableAmount: number;
  percentageOfTotal: number;
}

export interface ExpenseAnalysisReport {
  fromDate: string;
  toDate: string;
  groupBy: string;
  groups: ExpenseAnalysisGroup[];
  grandTotal: number;
}

export interface MonthlyFinancial {
  month: string;
  revenue: number;
  expenses: number;
}

export interface AgeingSummary {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
}

export interface RecentTransaction {
  id: number;
  date: string;
  type: string;
  reference: string;
  description: string;
  amount: number;
  status: string;
}

export interface DashboardSummary {
  totalRevenueYtd: number;
  totalExpensesYtd: number;
  accountsReceivable: number;
  cashAndBank: number;
  accountsPayable: number;
  openPipelineValue: number;
  openPipelineCount: number;
  totalInventoryValue: number;
  lowStockItemCount: number;
  expensesAwaitingApprovalCount: number;
  expensesAwaitingApprovalAmount: number;
  monthlyRevenueExpenses: MonthlyFinancial[];
  receivablesAgeing: AgeingSummary;
  recentTransactions: RecentTransaction[];
  overdueActivitiesCount?: number;
}
