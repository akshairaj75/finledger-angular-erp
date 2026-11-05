import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReportService } from './services/report.service';
import { NotificationService } from '../../core/services/notification.service';
import { AccountService } from '../accounting/services/account.service';
import { CostCenterService } from '../accounting/services/cost-center.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { Account } from '../../core/models/account.model';
import { CostCenter } from '../../core/models/cost-center.model';
import {
  ProfitLossReport,
  BalanceSheetReport,
  GeneralLedgerReport,
  VatReturnReport,
  StockValuationReport,
  StockMovementReport,
  PipelineForecastReport,
  ExpenseAnalysisReport
} from '../../core/models/report.model';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="report-viewer-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="breadcrumb">
            <a routerLink="/dashboard">Dashboard</a> / <span>Reports</span> /
            <span class="active">{{ reportTitle }}</span>
          </div>
          <h2>{{ reportTitle }}</h2>
        </div>
        <div class="header-actions">
          <div class="report-switcher">
            <select [ngModel]="reportType" (ngModelChange)="switchReportType($event)" class="form-control select-type">
              <option value="profit-loss">Profit & Loss Statement</option>
              <option value="balance-sheet">Balance Sheet</option>
              <option value="general-ledger">General Ledger</option>
              <option value="trial-balance">Trial Balance</option>
              <option value="ar-ageing">AR Ageing (Receivables)</option>
              <option value="ap-ageing">AP Ageing (Payables)</option>
              <option value="vat-return">VAT Return (FTA UAE)</option>
              <option value="stock-valuation">Stock Valuation</option>
              <option value="stock-movement">Stock Movement</option>
              <option value="pipeline-forecast">CRM Pipeline Forecast</option>
              <option value="expense-analysis">Expense Analysis</option>
            </select>
          </div>
          <button class="btn btn-secondary" (click)="handleExport('pdf')" [disabled]="loading">
            📄 Export PDF
          </button>
          <button class="btn btn-success" (click)="handleExport('xlsx')" [disabled]="loading">
            📊 Export Excel
          </button>
        </div>
      </div>

      <!-- Filters & Parameters Bar -->
      <div class="card filter-bar">
        <div class="filter-grid">
          <!-- Date range (for P&L, VAT, GL, Stock Movement, Pipeline, Expense) -->
          <div class="form-group" *ngIf="usesDateRange">
            <label>From Date</label>
            <input type="date" [(ngModel)]="fromDate" class="form-control" />
          </div>
          <div class="form-group" *ngIf="usesDateRange">
            <label>To Date</label>
            <input type="date" [(ngModel)]="toDate" class="form-control" />
          </div>

          <!-- As Of Date (for Balance Sheet, Trial Balance, Ageing, Stock Valuation) -->
          <div class="form-group" *ngIf="usesAsOfDate">
            <label>As Of Date</label>
            <input type="date" [(ngModel)]="asOfDate" class="form-control" />
          </div>

          <!-- Compare options (for P&L and Balance Sheet) -->
          <div class="form-group" *ngIf="reportType === 'profit-loss' || reportType === 'balance-sheet'">
            <label>Compare Period</label>
            <select [(ngModel)]="comparePeriod" class="form-control">
              <option value="">None</option>
              <option value="PRIOR_YEAR">Prior Year</option>
              <option value="PRIOR_PERIOD">Prior Period</option>
            </select>
          </div>

          <!-- Cost Center filter (for P&L) -->
          <div class="form-group" *ngIf="reportType === 'profit-loss'">
            <label>Cost Center</label>
            <select [(ngModel)]="selectedCostCenterId" class="form-control">
              <option [ngValue]="null">All Cost Centers</option>
              <option *ngFor="let cc of costCenters" [ngValue]="cc.id">
                {{ cc.code }} - {{ cc.name }}
              </option>
            </select>
          </div>

          <!-- Account selector (for GL) -->
          <div class="form-group" *ngIf="reportType === 'general-ledger'">
            <label>Select Account</label>
            <select [(ngModel)]="selectedAccountId" class="form-control">
              <option *ngFor="let acc of accounts" [ngValue]="acc.id">
                {{ acc.code }} - {{ acc.name }}
              </option>
            </select>
          </div>

          <!-- Warehouse filter (for Stock Valuation) -->
          <div class="form-group" *ngIf="reportType === 'stock-valuation'">
            <label>Warehouse</label>
            <select [(ngModel)]="selectedWarehouseId" class="form-control">
              <option [ngValue]="null">All Warehouses</option>
              <option *ngFor="let wh of warehouses" [ngValue]="wh.id">
                {{ wh.name }}
              </option>
            </select>
          </div>

          <!-- Group By (for Expense Analysis) -->
          <div class="form-group" *ngIf="reportType === 'expense-analysis'">
            <label>Group By</label>
            <select [(ngModel)]="expenseGroupBy" class="form-control">
              <option value="category">Category</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <div class="form-group align-end">
            <button class="btn btn-primary w-100" (click)="loadReport()" [disabled]="loading">
              {{ loading ? 'Generating...' : 'Run Report' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Report View Body -->
      <div class="card report-sheet" *ngIf="!loading">
        <!-- 1. PROFIT & LOSS -->
        <div *ngIf="reportType === 'profit-loss' && profitLossData" class="report-content">
          <div class="report-heading">
            <h3>Profit & Loss Statement</h3>
            <p>For the period {{ profitLossData.fromDate }} to {{ profitLossData.toDate }} (AED)</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Account</th>
                <th class="text-right">Current Period</th>
                <th class="text-right" *ngIf="comparePeriod">Comparative Period</th>
                <th class="text-right" *ngIf="comparePeriod">% Change</th>
              </tr>
            </thead>
            <tbody>
              <!-- Revenue -->
              <tr class="section-row"><td [attr.colspan]="comparePeriod ? 4 : 2">OPERATING REVENUE</td></tr>
              <tr *ngFor="let line of profitLossData.revenueLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod" [ngClass]="(line.changePct || 0) >= 0 ? 'text-success' : 'text-danger'">
                  {{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}
                </td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Revenue</td>
                <td class="text-right">{{ profitLossData.totalRevenue | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod">{{ (profitLossData.totalRevenueCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod"></td>
              </tr>

              <!-- COGS -->
              <tr class="section-row mt-2"><td [attr.colspan]="comparePeriod ? 4 : 2">COST OF GOODS SOLD</td></tr>
              <tr *ngFor="let line of profitLossData.cogsLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod">{{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Cost of Goods Sold</td>
                <td class="text-right">{{ profitLossData.totalCogs | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod">{{ (profitLossData.totalCogsCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod"></td>
              </tr>

              <!-- Gross Profit -->
              <tr class="major-row">
                <td>GROSS PROFIT</td>
                <td class="text-right font-weight-bold">{{ profitLossData.grossProfit | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold" *ngIf="comparePeriod">{{ (profitLossData.grossProfitCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod"></td>
              </tr>

              <!-- Operating Expenses -->
              <tr class="section-row"><td [attr.colspan]="comparePeriod ? 4 : 2">OPERATING EXPENSES</td></tr>
              <tr *ngFor="let line of profitLossData.expenseLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod">{{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Operating Expenses</td>
                <td class="text-right">{{ profitLossData.totalExpenses | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod">{{ (profitLossData.totalExpensesCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod"></td>
              </tr>

              <!-- Net Profit -->
              <tr class="grandtotal-row">
                <td>NET PROFIT / (LOSS)</td>
                <td class="text-right font-weight-bold" [ngClass]="profitLossData.netProfit >= 0 ? 'text-success' : 'text-danger'">
                  {{ profitLossData.netProfit | number:'1.2-2' }}
                </td>
                <td class="text-right font-weight-bold" *ngIf="comparePeriod">
                  {{ (profitLossData.netProfitCompare || 0) | number:'1.2-2' }}
                </td>
                <td *ngIf="comparePeriod"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. BALANCE SHEET -->
        <div *ngIf="reportType === 'balance-sheet' && balanceSheetData" class="report-content">
          <div class="report-heading">
            <h3>Statement of Financial Position (Balance Sheet)</h3>
            <p>As of {{ balanceSheetData.asOfDate }} (AED)</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Classification & Account</th>
                <th class="text-right">Balance (AED)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Assets -->
              <tr class="section-row"><td colspan="2">CURRENT ASSETS</td></tr>
              <tr *ngFor="let line of balanceSheetData.currentAssets" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Current Assets</td>
                <td class="text-right">{{ balanceSheetData.totalCurrentAssets | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="2">NON-CURRENT ASSETS</td></tr>
              <tr *ngFor="let line of balanceSheetData.nonCurrentAssets" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Non-Current Assets</td>
                <td class="text-right">{{ balanceSheetData.totalNonCurrentAssets | number:'1.2-2' }}</td>
              </tr>

              <tr class="major-row">
                <td>TOTAL ASSETS</td>
                <td class="text-right">{{ balanceSheetData.totalAssets | number:'1.2-2' }}</td>
              </tr>

              <!-- Liabilities -->
              <tr class="section-row"><td colspan="2">CURRENT LIABILITIES</td></tr>
              <tr *ngFor="let line of balanceSheetData.currentLiabilities" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Current Liabilities</td>
                <td class="text-right">{{ balanceSheetData.totalCurrentLiabilities | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="2">NON-CURRENT LIABILITIES</td></tr>
              <tr *ngFor="let line of balanceSheetData.nonCurrentLiabilities" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Non-Current Liabilities</td>
                <td class="text-right">{{ balanceSheetData.totalNonCurrentLiabilities | number:'1.2-2' }}</td>
              </tr>

              <!-- Equity -->
              <tr class="section-row"><td colspan="2">EQUITY & RESERVES</td></tr>
              <tr *ngFor="let line of balanceSheetData.equityLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr>
                <td class="indent-1">Net Income Year-To-Date</td>
                <td class="text-right">{{ balanceSheetData.netIncomeYearToDate | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>Total Equity</td>
                <td class="text-right">{{ balanceSheetData.totalEquity | number:'1.2-2' }}</td>
              </tr>

              <tr class="grandtotal-row">
                <td>TOTAL LIABILITIES AND EQUITY</td>
                <td class="text-right">{{ balanceSheetData.totalLiabilitiesAndEquity | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="balance-badge" [ngClass]="balanceSheetData.balanced ? 'badge-success' : 'badge-danger'">
            {{ balanceSheetData.balanced ? '✓ Statement of Financial Position is balanced (Assets = Liabilities + Equity)' : '⚠ Imbalance detected in Balance Sheet' }}
          </div>
        </div>

        <!-- 3. VAT RETURN (FTA UAE) -->
        <div *ngIf="reportType === 'vat-return' && vatReturnData" class="report-content">
          <div class="report-heading">
            <h3>Federal Tax Authority — VAT 201 Return</h3>
            <p>Period: {{ vatReturnData.fromDate }} to {{ vatReturnData.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Box #</th>
                <th>Description</th>
                <th class="text-right">Taxable Amount (AED)</th>
                <th class="text-right">VAT Amount (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section-row"><td colspan="4">VAT ON SALES AND ALL OTHER OUTPUTS</td></tr>
              <tr>
                <td><strong>Box 1a</strong></td>
                <td>Standard rated supplies in Abu Dhabi & Northern Emirates (5%)</td>
                <td class="text-right">{{ vatReturnData.standardRatedSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ vatReturnData.standardRatedSalesVat | number:'1.2-2' }}</td>
              </tr>
              <tr>
                <td><strong>Box 2</strong></td>
                <td>Supplies subject to the reverse charge provisions</td>
                <td class="text-right">0.00</td>
                <td class="text-right">0.00</td>
              </tr>
              <tr>
                <td><strong>Box 3</strong></td>
                <td>Zero-rated supplies</td>
                <td class="text-right">{{ vatReturnData.zeroRatedSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right">-</td>
              </tr>
              <tr>
                <td><strong>Box 4</strong></td>
                <td>Exempt supplies</td>
                <td class="text-right">{{ vatReturnData.exemptSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right">-</td>
              </tr>
              <tr class="subtotal-row">
                <td colspan="3">Total Output VAT Due</td>
                <td class="text-right font-weight-bold">{{ vatReturnData.totalOutputVat | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="4">VAT ON EXPENSES AND ALL OTHER INPUTS</td></tr>
              <tr>
                <td><strong>Box 1g</strong></td>
                <td>Standard rated expenses and purchases (5%)</td>
                <td class="text-right">{{ vatReturnData.standardRatedPurchasesAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ vatReturnData.standardRatedPurchasesVat | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td colspan="3">Total Recoverable Input VAT</td>
                <td class="text-right font-weight-bold">{{ vatReturnData.totalInputVat | number:'1.2-2' }}</td>
              </tr>

              <tr class="grandtotal-row">
                <td colspan="3"><strong>BOX 13: NET VAT PAYABLE / (RECOVERABLE)</strong></td>
                <td class="text-right font-weight-bold" [ngClass]="vatReturnData.netVatDue >= 0 ? 'text-primary' : 'text-success'">
                  {{ vatReturnData.netVatDue | number:'1.2-2' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 4. STOCK VALUATION -->
        <div *ngIf="reportType === 'stock-valuation' && stockValuationData" class="report-content">
          <div class="report-heading">
            <h3>Inventory Stock Valuation Report</h3>
            <p>Warehouse: {{ stockValuationData.warehouseName }} | As of: {{ stockValuationData.asOfDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Warehouse</th>
                <th class="text-right">Qty On Hand</th>
                <th class="text-right">Avg Cost</th>
                <th class="text-right">Total Valuation (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of stockValuationData.lines">
                <td><strong>{{ item.sku }}</strong></td>
                <td>{{ item.itemName }}</td>
                <td>{{ item.categoryName }}</td>
                <td>{{ item.warehouseName }}</td>
                <td class="text-right">{{ item.quantityOnHand | number:'1.2-2' }}</td>
                <td class="text-right">{{ item.unitCost | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ item.totalValue | number:'1.2-2' }}</td>
              </tr>
              <tr class="grandtotal-row">
                <td colspan="6">GRAND TOTAL INVENTORY VALUATION ({{ stockValuationData.totalItems }} items)</td>
                <td class="text-right font-weight-bold">{{ stockValuationData.totalValuation | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 5. PIPELINE FORECAST -->
        <div *ngIf="reportType === 'pipeline-forecast' && pipelineData" class="report-content">
          <div class="report-heading">
            <h3>CRM Sales Pipeline & Revenue Forecast</h3>
            <p>Period: {{ pipelineData.fromDate }} to {{ pipelineData.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th class="text-center">Deals</th>
                <th class="text-center">Probability</th>
                <th class="text-right">Total Value (AED)</th>
                <th class="text-right">Weighted Forecast (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let stage of pipelineData.stages">
                <td><strong>{{ stage.stageName }}</strong></td>
                <td class="text-center">{{ stage.dealCount }}</td>
                <td class="text-center">{{ stage.probability }}%</td>
                <td class="text-right">{{ stage.totalValue | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ stage.weightedValue | number:'1.2-2' }}</td>
              </tr>
              <tr class="grandtotal-row">
                <td>TOTAL PIPELINE ({{ pipelineData.totalDeals }} open opportunities)</td>
                <td colspan="2"></td>
                <td class="text-right">{{ pipelineData.totalPipelineValue | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold text-success">{{ pipelineData.totalWeightedValue | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 6. EXPENSE ANALYSIS -->
        <div *ngIf="reportType === 'expense-analysis' && expenseData" class="report-content">
          <div class="report-heading">
            <h3>Operational Expense Analysis</h3>
            <p>Grouped by: {{ expenseData.groupBy | titlecase }} | {{ expenseData.fromDate }} to {{ expenseData.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Category / Entity</th>
                <th class="text-center">Claims</th>
                <th class="text-right">Reimbursable (AED)</th>
                <th class="text-right">Total Amount (AED)</th>
                <th class="text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let g of expenseData.groups">
                <td><strong>{{ g.groupName }}</strong></td>
                <td class="text-center">{{ g.claimCount }}</td>
                <td class="text-right">{{ g.reimbursableAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ g.totalAmount | number:'1.2-2' }}</td>
                <td class="text-right">{{ g.percentageOfTotal | number:'1.1-1' }}%</td>
              </tr>
              <tr class="grandtotal-row">
                <td>GRAND TOTAL OPERATING EXPENSES</td>
                <td colspan="2"></td>
                <td class="text-right font-weight-bold">{{ expenseData.grandTotal | number:'1.2-2' }}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 7. GENERAL LEDGER / TRIAL BALANCE / AGEING FALLBACK -->
        <div *ngIf="genericTableData" class="report-content">
          <div class="report-heading">
            <h3>{{ reportTitle }}</h3>
          </div>
          <pre class="json-preview">{{ genericTableData | json }}</pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-viewer-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .breadcrumb {
      font-size: 0.8125rem;
      color: #64748b;
      margin-bottom: 0.25rem;
    }

    .breadcrumb a {
      color: #2563eb;
      text-decoration: none;
    }

    .breadcrumb .active {
      color: #0f172a;
      font-weight: 600;
    }

    .page-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .select-type {
      font-weight: 600;
      color: #1e293b;
      min-width: 200px;
    }

    .card {
      background: #ffffff;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      align-items: end;
    }

    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      margin-bottom: 0.35rem;
    }

    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #1e293b;
    }

    .align-end {
      display: flex;
      align-items: flex-end;
    }

    .report-sheet {
      background: #ffffff;
      min-height: 500px;
      border-radius: 8px;
      padding: 2rem;
    }

    .report-heading {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }

    .report-heading h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
    }

    .report-heading p {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .report-table th {
      background: #f8fafc;
      padding: 0.65rem 0.75rem;
      font-weight: 700;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }

    .report-table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .section-row td {
      background: #f8fafc;
      font-weight: 700;
      color: #1e293b;
      font-size: 0.8125rem;
      padding-top: 1rem;
      border-bottom: 1px solid #cbd5e1;
    }

    .subtotal-row td {
      font-weight: 700;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      color: #0f172a;
    }

    .major-row td {
      font-weight: 800;
      background: #f1f5f9;
      border-top: 2px solid #94a3b8;
      border-bottom: 2px solid #94a3b8;
      font-size: 0.95rem;
    }

    .grandtotal-row td {
      font-weight: 800;
      font-size: 1rem;
      border-top: 2px solid #0f172a;
      border-bottom: 4px double #0f172a;
      color: #0f172a;
      padding-top: 0.75rem;
      padding-bottom: 0.75rem;
    }

    .indent-1 {
      padding-left: 2rem !important;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background-color: #f1f5f9;
    }

    .acc-code {
      font-family: monospace;
      font-weight: 600;
      color: #2563eb;
      margin-right: 0.5rem;
    }

    .balance-badge {
      margin-top: 1.5rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      text-align: center;
    }

    .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }

    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #0284c7; color: #fff; }
    .btn-success { background: #10b981; color: #fff; }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .text-primary { color: #2563eb; }
    .text-muted { color: #94a3b8; }
    .font-weight-bold { font-weight: 700; }
    .json-preview { background: #f8fafc; padding: 1rem; border-radius: 6px; font-size: 0.8125rem; overflow-x: auto; }
  `]
})
export class ReportViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reportService = inject(ReportService);
  private accountService = inject(AccountService);
  private costCenterService = inject(CostCenterService);
  private inventoryService = inject(InventoryService);
  private notificationService = inject(NotificationService);

  reportType: string = 'profit-loss';
  reportTitle: string = 'Profit & Loss Statement';
  loading: boolean = false;

  // Filter models
  fromDate: string = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  toDate: string = new Date().toISOString().split('T')[0];
  asOfDate: string = new Date().toISOString().split('T')[0];
  comparePeriod: string = '';
  selectedCostCenterId: number | null = null;
  selectedAccountId: number | null = null;
  selectedWarehouseId: number | null = null;
  expenseGroupBy: string = 'category';

  // Catalogs
  accounts: Account[] = [];
  costCenters: CostCenter[] = [];
  warehouses: any[] = [];

  // Report payloads
  profitLossData: ProfitLossReport | null = null;
  balanceSheetData: BalanceSheetReport | null = null;
  vatReturnData: VatReturnReport | null = null;
  stockValuationData: StockValuationReport | null = null;
  pipelineData: PipelineForecastReport | null = null;
  expenseData: ExpenseAnalysisReport | null = null;
  genericTableData: any = null;

  get usesDateRange(): boolean {
    return ['profit-loss', 'vat-return', 'general-ledger', 'stock-movement', 'pipeline-forecast', 'expense-analysis'].includes(this.reportType);
  }

  get usesAsOfDate(): boolean {
    return ['balance-sheet', 'trial-balance', 'ar-ageing', 'ap-ageing', 'stock-valuation'].includes(this.reportType);
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['type']) {
        this.reportType = params['type'];
        this.updateReportTitle();
        this.loadCatalogs();
        this.loadReport();
      }
    });
  }

  updateReportTitle(): void {
    const titles: Record<string, string> = {
      'profit-loss': 'Profit & Loss Statement',
      'balance-sheet': 'Statement of Financial Position (Balance Sheet)',
      'general-ledger': 'General Ledger Report',
      'trial-balance': 'Trial Balance',
      'ar-ageing': 'Accounts Receivable Ageing',
      'ap-ageing': 'Accounts Payable Ageing',
      'vat-return': 'VAT Return (FTA UAE Form 201)',
      'stock-valuation': 'Stock Valuation Report',
      'stock-movement': 'Stock Movement Ledger',
      'pipeline-forecast': 'CRM Sales Pipeline Forecast',
      'expense-analysis': 'Expense Analysis Report'
    };
    this.reportTitle = titles[this.reportType] || 'Financial Report';
  }

  switchReportType(type: string): void {
    this.router.navigate(['/reports', type]);
  }

  loadCatalogs(): void {
    this.costCenterService.getCostCenters().subscribe({
      next: (res) => this.costCenters = res,
      error: () => {}
    });
    this.accountService.getAccounts().subscribe({
      next: (res: any) => {
        const accList = res?.content || (Array.isArray(res) ? res : []);
        this.accounts = accList;
        if (accList.length > 0 && !this.selectedAccountId) {
          this.selectedAccountId = accList[0].id;
        }
      },
      error: () => {}
    });
    this.inventoryService.getWarehouses().subscribe({
      next: (res) => this.warehouses = res,
      error: () => {}
    });
  }

  loadReport(): void {
    this.loading = true;
    this.resetData();

    switch (this.reportType) {
      case 'profit-loss':
        this.reportService.getProfitLoss(this.fromDate, this.toDate, this.comparePeriod, this.selectedCostCenterId || undefined).subscribe({
          next: (res) => { this.profitLossData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'balance-sheet':
        this.reportService.getBalanceSheet(this.asOfDate, this.comparePeriod).subscribe({
          next: (res) => { this.balanceSheetData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'vat-return':
        this.reportService.getVatReturn(this.fromDate, this.toDate).subscribe({
          next: (res) => { this.vatReturnData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'stock-valuation':
        this.reportService.getStockValuation(this.asOfDate, this.selectedWarehouseId || undefined).subscribe({
          next: (res) => { this.stockValuationData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'pipeline-forecast':
        this.reportService.getPipelineForecast(this.fromDate, this.toDate).subscribe({
          next: (res) => { this.pipelineData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'expense-analysis':
        this.reportService.getExpenseAnalysis(this.fromDate, this.toDate, this.expenseGroupBy).subscribe({
          next: (res) => { this.expenseData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'general-ledger':
        if (this.selectedAccountId) {
          this.reportService.getGeneralLedger(this.selectedAccountId, this.fromDate, this.toDate).subscribe({
            next: (res) => { this.genericTableData = res; this.loading = false; },
            error: (err) => this.handleError(err)
          });
        } else {
          this.loading = false;
        }
        break;
      case 'trial-balance':
        this.reportService.getTrialBalance(this.asOfDate).subscribe({
          next: (res) => { this.genericTableData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'ar-ageing':
        this.reportService.getArAgeing(this.asOfDate).subscribe({
          next: (res) => { this.genericTableData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      case 'ap-ageing':
        this.reportService.getApAgeing(this.asOfDate).subscribe({
          next: (res) => { this.genericTableData = res; this.loading = false; },
          error: (err) => this.handleError(err)
        });
        break;
      default:
        this.loading = false;
    }
  }

  drillDownGl(accountId: number): void {
    this.router.navigate(['/reports', 'general-ledger'], {
      queryParams: { accountId, from: this.fromDate, to: this.toDate }
    });
  }

  handleExport(format: 'pdf' | 'xlsx'): void {
    this.loading = true;
    const params: Record<string, string> = {
      from: this.fromDate,
      to: this.toDate,
      asOf: this.asOfDate
    };
    if (this.comparePeriod) params['compare'] = this.comparePeriod;
    if (this.selectedCostCenterId) params['costCenterId'] = this.selectedCostCenterId.toString();

    this.reportService.exportReport(this.reportType, format, params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.reportType}-report.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.loading = false;
        this.notificationService.success(`Report exported successfully as ${format.toUpperCase()}`);
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error('Export failed');
      }
    });
  }

  private resetData(): void {
    this.profitLossData = null;
    this.balanceSheetData = null;
    this.vatReturnData = null;
    this.stockValuationData = null;
    this.pipelineData = null;
    this.expenseData = null;
    this.genericTableData = null;
  }

  private handleError(err: any): void {
    this.loading = false;
    this.notificationService.error(err.error?.message || 'Failed to load report data');
  }
}
