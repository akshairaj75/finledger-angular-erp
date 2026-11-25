import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { ReportService } from './services/report.service';
import { NotificationService } from '../../core/services/notification.service';
import { AccountService } from '../accounting/services/account.service';
import { CostCenterService } from '../accounting/services/cost-center.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { Account } from '../../core/models/account.model';
import { CostCenter } from '../../core/models/cost-center.model';
import { Item } from '../../core/models/inventory.model';
import {
  ProfitLossReport,
  BalanceSheetReport,
  GeneralLedgerReport,
  TrialBalanceReport,
  ArAgeingReport,
  ApAgeingReport,
  VatReturnReport,
  StockValuationReport,
  StockMovementReport,
  PipelineForecastReport,
  ExpenseAnalysisReport
} from '../../core/models/report.model';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  template: `
    <div class="report-viewer-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="breadcrumb">
            <a routerLink="/dashboard">{{ 'nav.dashboard' | translate }}</a> / <span>{{ 'nav.reports' | translate }}</span> /
            <span class="active">{{ reportTitleKey() | translate }}</span>
          </div>
          <h2>{{ reportTitleKey() | translate }}</h2>
        </div>
        <div class="header-actions">
          <div class="report-switcher">
            <select [ngModel]="reportType()" (ngModelChange)="switchReportType($event)" class="form-control select-type">
              <option value="profit-loss">{{ 'reports.profitLossTitle' | translate }}</option>
              <option value="balance-sheet">{{ 'reports.balanceSheetTitle' | translate }}</option>
              <option value="general-ledger">{{ 'reports.generalLedgerTitle' | translate }}</option>
              <option value="trial-balance">{{ 'reports.trialBalanceTitle' | translate }}</option>
              <option value="ar-ageing">{{ 'reports.arAgeingTitle' | translate }}</option>
              <option value="ap-ageing">{{ 'reports.apAgeingTitle' | translate }}</option>
              <option value="vat-return">{{ 'reports.vatReturnTitle' | translate }}</option>
              <option value="stock-valuation">{{ 'reports.stockValuationTitle' | translate }}</option>
              <option value="stock-movement">{{ 'reports.stockMovementTitle' | translate }}</option>
              <option value="pipeline-forecast">{{ 'reports.pipelineForecastTitle' | translate }}</option>
              <option value="expense-analysis">{{ 'reports.expenseAnalysisTitle' | translate }}</option>
            </select>
          </div>
          <button class="btn btn-secondary" (click)="handleExport('pdf')" [disabled]="loading()">
            📄 {{ 'common.exportPdf' | translate }}
          </button>
          <button class="btn btn-success" (click)="handleExport('xlsx')" [disabled]="loading()">
            📊 {{ 'common.exportExcel' | translate }}
          </button>
        </div>
      </div>

      <!-- Filters & Parameters Bar -->
      <div class="card filter-bar">
        <div class="filter-grid">
          <!-- Date range (for P&L, VAT, GL, Stock Movement, Pipeline, Expense) -->
          <div class="form-group" *ngIf="usesDateRange()">
            <label>{{ 'reports.fromDate' | translate }}</label>
            <input type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event)" class="form-control" />
          </div>
          <div class="form-group" *ngIf="usesDateRange()">
            <label>{{ 'reports.toDate' | translate }}</label>
            <input type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event)" class="form-control" />
          </div>

          <!-- As Of Date (for Balance Sheet, Trial Balance, Ageing, Stock Valuation) -->
          <div class="form-group" *ngIf="usesAsOfDate()">
            <label>{{ 'reports.asOfDate' | translate }}</label>
            <input type="date" [ngModel]="asOfDate()" (ngModelChange)="asOfDate.set($event)" class="form-control" />
          </div>

          <!-- Compare options (for P&L and Balance Sheet) -->
          <div class="form-group" *ngIf="reportType() === 'profit-loss' || reportType() === 'balance-sheet'">
            <label>{{ 'reports.comparePeriod' | translate }}</label>
            <select [ngModel]="comparePeriod()" (ngModelChange)="comparePeriod.set($event)" class="form-control">
              <option value="">{{ 'reports.none' | translate }}</option>
              <option value="PRIOR_YEAR">{{ 'reports.priorYear' | translate }}</option>
              <option value="PRIOR_PERIOD">{{ 'reports.priorPeriod' | translate }}</option>
            </select>
          </div>

          <!-- Cost Center filter (for P&L) -->
          <div class="form-group" *ngIf="reportType() === 'profit-loss'">
            <label>{{ 'reports.costCenter' | translate }}</label>
            <select [ngModel]="selectedCostCenterId()" (ngModelChange)="selectedCostCenterId.set($event)" class="form-control">
              <option [ngValue]="null">{{ 'reports.allCostCenters' | translate }}</option>
              <option *ngFor="let cc of costCenters()" [ngValue]="cc.id">
                {{ cc.code }} - {{ cc.name }}
              </option>
            </select>
          </div>

          <!-- Account selector (for GL) -->
          <div class="form-group" *ngIf="reportType() === 'general-ledger'">
            <label>{{ 'reports.selectAccount' | translate }}</label>
            <select [ngModel]="selectedAccountId()" (ngModelChange)="selectedAccountId.set($event)" class="form-control">
              <option *ngFor="let acc of accounts()" [ngValue]="acc.id">
                {{ acc.code }} - {{ acc.name }}
              </option>
            </select>
          </div>

          <!-- Item selector (for Stock Movement) -->
          <div class="form-group" *ngIf="reportType() === 'stock-movement'">
            <label>{{ 'reports.selectItem' | translate }}</label>
            <select [ngModel]="selectedItemId()" (ngModelChange)="selectedItemId.set($event)" class="form-control">
              <option *ngFor="let item of items()" [ngValue]="item.id">
                {{ item.sku }} - {{ item.name }}
              </option>
            </select>
          </div>

          <!-- Warehouse filter (for Stock Valuation) -->
          <div class="form-group" *ngIf="reportType() === 'stock-valuation'">
            <label>{{ 'reports.warehouse' | translate }}</label>
            <select [ngModel]="selectedWarehouseId()" (ngModelChange)="selectedWarehouseId.set($event)" class="form-control">
              <option [ngValue]="null">{{ 'reports.allWarehouses' | translate }}</option>
              <option *ngFor="let wh of warehouses()" [ngValue]="wh.id">
                {{ wh.name }}
              </option>
            </select>
          </div>

          <!-- Group By (for Expense Analysis) -->
          <div class="form-group" *ngIf="reportType() === 'expense-analysis'">
            <label>{{ 'reports.groupBy' | translate }}</label>
            <select [ngModel]="expenseGroupBy()" (ngModelChange)="expenseGroupBy.set($event)" class="form-control">
              <option value="category">{{ 'reports.category' | translate }}</option>
              <option value="employee">{{ 'reports.employee' | translate }}</option>
            </select>
          </div>

          <div class="form-group align-end">
            <button class="btn btn-primary w-100" (click)="loadReport()" [disabled]="loading()">
              {{ loading() ? ('reports.generating' | translate) : ('reports.runReport' | translate) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Report View Body -->
      <div class="card report-sheet" *ngIf="!loading()">
        <!-- 1. PROFIT & LOSS -->
        <div *ngIf="reportType() === 'profit-loss' && profitLossData() as pl" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.profitLossTitle' | translate }}</h3>
            <p>{{ 'reports.forThePeriod' | translate:{ from: pl.fromDate, to: pl.toDate } }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'common.account' | translate }}</th>
                <th class="text-right">{{ 'reports.currentPeriod' | translate }}</th>
                <th class="text-right" *ngIf="comparePeriod()">{{ 'reports.comparativePeriod' | translate }}</th>
                <th class="text-right" *ngIf="comparePeriod()">{{ 'reports.percentChange' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <!-- Revenue -->
              <tr class="section-row"><td [attr.colspan]="comparePeriod() ? 4 : 2">{{ 'reports.operatingRevenue' | translate }}</td></tr>
              <tr *ngFor="let line of pl.revenueLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod()">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()" [ngClass]="(line.changePct || 0) >= 0 ? 'text-success' : 'text-danger'">
                  {{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}
                </td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalRevenue' | translate }}</td>
                <td class="text-right">{{ pl.totalRevenue | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()">{{ (pl.totalRevenueCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod()"></td>
              </tr>

              <!-- COGS -->
              <tr class="section-row mt-2"><td [attr.colspan]="comparePeriod() ? 4 : 2">{{ 'reports.cogs' | translate }}</td></tr>
              <tr *ngFor="let line of pl.cogsLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod()">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()">{{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalCogs' | translate }}</td>
                <td class="text-right">{{ pl.totalCogs | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()">{{ (pl.totalCogsCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod()"></td>
              </tr>

              <!-- Gross Profit -->
              <tr class="major-row">
                <td>{{ 'reports.grossProfit' | translate }}</td>
                <td class="text-right font-weight-bold">{{ pl.grossProfit | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold" *ngIf="comparePeriod()">{{ (pl.grossProfitCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod()"></td>
              </tr>

              <!-- Operating Expenses -->
              <tr class="section-row"><td [attr.colspan]="comparePeriod() ? 4 : 2">{{ 'reports.operatingExpenses' | translate }}</td></tr>
              <tr *ngFor="let line of pl.expenseLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1">
                  <span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}
                </td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                <td class="text-right text-muted" *ngIf="comparePeriod()">{{ (line.compareAmount || 0) | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()">{{ line.changePct != null ? (line.changePct | number:'1.1-1') + '%' : '-' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalOperatingExpenses' | translate }}</td>
                <td class="text-right">{{ pl.totalExpenses | number:'1.2-2' }}</td>
                <td class="text-right" *ngIf="comparePeriod()">{{ (pl.totalExpensesCompare || 0) | number:'1.2-2' }}</td>
                <td *ngIf="comparePeriod()"></td>
              </tr>

              <!-- Net Profit -->
              <tr class="grandtotal-row">
                <td>{{ 'reports.netProfitLoss' | translate }}</td>
                <td class="text-right font-weight-bold" [ngClass]="pl.netProfit >= 0 ? 'text-success' : 'text-danger'">
                  {{ pl.netProfit | number:'1.2-2' }}
                </td>
                <td class="text-right font-weight-bold" *ngIf="comparePeriod()">
                  {{ (pl.netProfitCompare || 0) | number:'1.2-2' }}
                </td>
                <td *ngIf="comparePeriod()"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. BALANCE SHEET -->
        <div *ngIf="reportType() === 'balance-sheet' && balanceSheetData() as bs" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.balanceSheetTitle' | translate }}</h3>
            <p>{{ 'reports.asOfDate' | translate }}: {{ bs.asOfDate }} (AED)</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'reports.classificationAccount' | translate }}</th>
                <th class="text-right">{{ 'reports.balance' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Assets -->
              <tr class="section-row"><td colspan="2">{{ 'reports.currentAssets' | translate }}</td></tr>
              <tr *ngFor="let line of bs.currentAssets" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalCurrentAssets' | translate }}</td>
                <td class="text-right">{{ bs.totalCurrentAssets | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="2">{{ 'reports.nonCurrentAssets' | translate }}</td></tr>
              <tr *ngFor="let line of bs.nonCurrentAssets" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalNonCurrentAssets' | translate }}</td>
                <td class="text-right">{{ bs.totalNonCurrentAssets | number:'1.2-2' }}</td>
              </tr>

              <tr class="major-row">
                <td>{{ 'reports.totalAssets' | translate }}</td>
                <td class="text-right">{{ bs.totalAssets | number:'1.2-2' }}</td>
              </tr>

              <!-- Liabilities -->
              <tr class="section-row"><td colspan="2">{{ 'reports.currentLiabilities' | translate }}</td></tr>
              <tr *ngFor="let line of bs.currentLiabilities" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalCurrentLiabilities' | translate }}</td>
                <td class="text-right">{{ bs.totalCurrentLiabilities | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="2">{{ 'reports.nonCurrentLiabilities' | translate }}</td></tr>
              <tr *ngFor="let line of bs.nonCurrentLiabilities" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalNonCurrentLiabilities' | translate }}</td>
                <td class="text-right">{{ bs.totalNonCurrentLiabilities | number:'1.2-2' }}</td>
              </tr>

              <!-- Equity -->
              <tr class="section-row"><td colspan="2">{{ 'reports.equityReserves' | translate }}</td></tr>
              <tr *ngFor="let line of bs.equityLines" class="clickable-row" (click)="drillDownGl(line.accountId)">
                <td class="indent-1"><span class="acc-code">{{ line.accountCode }}</span> {{ line.accountName }}</td>
                <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
              </tr>
              <tr>
                <td class="indent-1">{{ 'reports.netIncomeYtd' | translate }}</td>
                <td class="text-right">{{ bs.netIncomeYearToDate | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td>{{ 'reports.totalEquity' | translate }}</td>
                <td class="text-right">{{ bs.totalEquity | number:'1.2-2' }}</td>
              </tr>

              <tr class="grandtotal-row">
                <td>{{ 'reports.totalLiabilitiesAndEquity' | translate }}</td>
                <td class="text-right">{{ bs.totalLiabilitiesAndEquity | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="balance-badge" [ngClass]="bs.balanced ? 'badge-success' : 'badge-danger'">
            {{ bs.balanced ? ('reports.balanceSheetBalanced' | translate) : ('reports.balanceSheetImbalance' | translate) }}
          </div>
        </div>

        <!-- 3. VAT RETURN (FTA UAE) -->
        <div *ngIf="reportType() === 'vat-return' && vatReturnData() as vat" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.vatReturnTitle' | translate }}</h3>
            <p>{{ 'reports.filterPeriod' | translate }}: {{ vat.fromDate }} - {{ vat.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'reports.boxNo' | translate }}</th>
                <th>{{ 'common.description' | translate }}</th>
                <th class="text-right">{{ 'purchases.taxableAmount' | translate }} (AED)</th>
                <th class="text-right">{{ 'common.tax' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section-row"><td colspan="4">{{ 'reports.vatOnSales' | translate }}</td></tr>
              <tr>
                <td><strong>Box 1a</strong></td>
                <td>{{ 'reports.standardRatedSupplies' | translate }}</td>
                <td class="text-right">{{ vat.standardRatedSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ vat.standardRatedSalesVat | number:'1.2-2' }}</td>
              </tr>
              <tr>
                <td><strong>Box 2</strong></td>
                <td>{{ 'reports.reverseChargeSupplies' | translate }}</td>
                <td class="text-right">0.00</td>
                <td class="text-right">0.00</td>
              </tr>
              <tr>
                <td><strong>Box 3</strong></td>
                <td>{{ 'reports.zeroRatedSupplies' | translate }}</td>
                <td class="text-right">{{ vat.zeroRatedSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right">-</td>
              </tr>
              <tr>
                <td><strong>Box 4</strong></td>
                <td>{{ 'reports.exemptSupplies' | translate }}</td>
                <td class="text-right">{{ vat.exemptSalesAmount | number:'1.2-2' }}</td>
                <td class="text-right">-</td>
              </tr>
              <tr class="subtotal-row">
                <td colspan="3">{{ 'reports.totalOutputVat' | translate }}</td>
                <td class="text-right font-weight-bold">{{ vat.totalOutputVat | number:'1.2-2' }}</td>
              </tr>

              <tr class="section-row"><td colspan="4">{{ 'reports.vatOnExpenses' | translate }}</td></tr>
              <tr>
                <td><strong>Box 1g</strong></td>
                <td>{{ 'reports.standardRatedExpenses' | translate }}</td>
                <td class="text-right">{{ vat.standardRatedPurchasesAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ vat.standardRatedPurchasesVat | number:'1.2-2' }}</td>
              </tr>
              <tr class="subtotal-row">
                <td colspan="3">{{ 'reports.totalInputVat' | translate }}</td>
                <td class="text-right font-weight-bold">{{ vat.totalInputVat | number:'1.2-2' }}</td>
              </tr>

              <tr class="grandtotal-row">
                <td colspan="3"><strong>{{ 'reports.box13NetVat' | translate }}</strong></td>
                <td class="text-right font-weight-bold" [ngClass]="vat.netVatDue >= 0 ? 'text-primary' : 'text-success'">
                  {{ vat.netVatDue | number:'1.2-2' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 4. STOCK VALUATION -->
        <div *ngIf="reportType() === 'stock-valuation' && stockValuationData() as sv" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.stockValuationTitle' | translate }}</h3>
            <p>{{ 'inventory.warehouse' | translate }}: {{ sv.warehouseName }} | {{ 'reports.asOfDate' | translate }}: {{ sv.asOfDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'inventory.sku' | translate }}</th>
                <th>{{ 'inventory.itemName' | translate }}</th>
                <th>{{ 'common.category' | translate }}</th>
                <th>{{ 'inventory.warehouse' | translate }}</th>
                <th class="text-right">{{ 'inventory.qtyOnHand' | translate }}</th>
                <th class="text-right">{{ 'inventory.avgCost' | translate }}</th>
                <th class="text-right">{{ 'inventory.totalValuation' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of sv.lines">
                <td><strong>{{ item.sku }}</strong></td>
                <td>{{ item.itemName }}</td>
                <td>{{ item.categoryName }}</td>
                <td>{{ item.warehouseName }}</td>
                <td class="text-right">{{ item.quantityOnHand | number:'1.2-2' }}</td>
                <td class="text-right">{{ item.unitCost | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ item.totalValue | number:'1.2-2' }}</td>
              </tr>
              <tr class="grandtotal-row">
                <td colspan="6">{{ 'inventory.grandTotalValuation' | translate:{ count: sv.totalItems } }}</td>
                <td class="text-right font-weight-bold">{{ sv.totalValuation | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 5. PIPELINE FORECAST -->
        <div *ngIf="reportType() === 'pipeline-forecast' && pipelineData() as pipe" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.pipelineForecastTitle' | translate }}</h3>
            <p>{{ 'reports.filterPeriod' | translate }}: {{ pipe.fromDate }} - {{ pipe.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'crm.stage' | translate }}</th>
                <th class="text-center">{{ 'crm.deals' | translate }}</th>
                <th class="text-center">{{ 'crm.probability' | translate }}</th>
                <th class="text-right">{{ 'common.total' | translate }} (AED)</th>
                <th class="text-right">{{ 'crm.weightedForecast' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let stage of pipe.stages">
                <td><strong>{{ stage.stageName }}</strong></td>
                <td class="text-center">{{ stage.dealCount }}</td>
                <td class="text-center">{{ stage.probability }}%</td>
                <td class="text-right">{{ stage.totalValue | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ stage.weightedValue | number:'1.2-2' }}</td>
              </tr>
              <tr class="grandtotal-row">
                <td>{{ 'crm.totalPipeline' | translate:{ count: pipe.totalDeals } }}</td>
                <td colspan="2"></td>
                <td class="text-right">{{ pipe.totalPipelineValue | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold text-success">{{ pipe.totalWeightedValue | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 6. EXPENSE ANALYSIS -->
        <div *ngIf="reportType() === 'expense-analysis' && expenseData() as exp" class="report-content">
          <div class="report-heading">
            <h3>{{ 'reports.expenseAnalysisTitle' | translate }}</h3>
            <p>{{ 'reports.groupBy' | translate }}: {{ exp.groupBy | titlecase }} | {{ exp.fromDate }} - {{ exp.toDate }}</p>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>{{ 'expenses.categoryEntity' | translate }}</th>
                <th class="text-center">{{ 'expenses.claims' | translate }}</th>
                <th class="text-right">{{ 'expenses.reimbursable' | translate }} (AED)</th>
                <th class="text-right">{{ 'common.total' | translate }} (AED)</th>
                <th class="text-right">{{ 'reports.percentOfTotal' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let g of exp.groups">
                <td><strong>{{ g.groupName }}</strong></td>
                <td class="text-center">{{ g.claimCount }}</td>
                <td class="text-right">{{ g.reimbursableAmount | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ g.totalAmount | number:'1.2-2' }}</td>
                <td class="text-right">{{ g.percentageOfTotal | number:'1.1-1' }}%</td>
              </tr>
              <tr class="grandtotal-row">
                <td>{{ 'reports.grandTotalExpenses' | translate }}</td>
                <td colspan="2"></td>
                <td class="text-right font-weight-bold">{{ exp.grandTotal | number:'1.2-2' }}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 7. TRIAL BALANCE -->
        <div *ngIf="reportType() === 'trial-balance' && trialBalanceData() as tb" class="report-content">
          <div class="report-heading">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3>{{ 'reports.trialBalanceTitle' | translate }}</h3>
                <p>{{ 'reports.asOfDate' | translate }}: {{ tb.asOfDate | date:'dd-MMM-yyyy' }} (AED)</p>
              </div>
              <div>
                <span *ngIf="tb.isBalanced" class="balance-badge badge-success" style="display: inline-block; margin-top: 0;">
                  {{ 'reports.tbBalanced' | translate }}
                </span>
                <span *ngIf="!tb.isBalanced" class="balance-badge badge-danger" style="display: inline-block; margin-top: 0;">
                  {{ 'reports.tbOutBalance' | translate:{ diff: ((tb.totalDebit - tb.totalCredit) | number:'1.2-2') } }}
                </span>
              </div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 140px;">{{ 'accounting.code' | translate }}</th>
                <th>{{ 'accounting.accountName' | translate }}</th>
                <th style="width: 140px;">{{ 'common.type' | translate }}</th>
                <th class="text-right" style="width: 160px;">{{ 'accounting.debit' | translate }} (AED)</th>
                <th class="text-right" style="width: 160px;">{{ 'accounting.credit' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let line of tb.lines" class="clickable-row" (click)="drillDownGl(line.accountId)" title="Click to view General Ledger for {{ line.accountCode }}">
                <td><span class="acc-code">{{ line.accountCode }}</span></td>
                <td><strong>{{ line.accountName }}</strong></td>
                <td><span class="type-pill">{{ line.accountType }}</span></td>
                <td class="text-right">{{ line.debitBalance ? (line.debitBalance | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ line.creditBalance ? (line.creditBalance | number:'1.2-2') : '-' }}</td>
              </tr>
              <tr *ngIf="!tb.lines || tb.lines.length === 0">
                <td colspan="5" class="text-center text-muted" style="padding: 2rem;">{{ 'reports.noPostedJournals' | translate }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="grandtotal-row">
                <td colspan="3">{{ 'common.total' | translate }}</td>
                <td class="text-right font-weight-bold">{{ tb.totalDebit | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ tb.totalCredit | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 8. GENERAL LEDGER -->
        <div *ngIf="reportType() === 'general-ledger' && generalLedgerData() as gl" class="report-content">
          <div class="report-heading">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3>{{ 'reports.generalLedgerTitle' | translate }} &mdash; {{ gl.accountCode }} {{ gl.accountName }}</h3>
                <p>{{ 'reports.filterPeriod' | translate }}: {{ gl.fromDate | date:'dd-MMM-yyyy' }} - {{ gl.toDate | date:'dd-MMM-yyyy' }} &bull; {{ 'accounting.normalBalance' | translate }}: {{ gl.normalBalance }} &bull; {{ 'common.type' | translate }}: {{ gl.accountType }}</p>
              </div>
              <div class="gl-summary-cards">
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'accounting.openingBalance' | translate }}</span>
                  <span class="gl-card-val">{{ gl.openingBalance | number:'1.2-2' }} AED</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.netMovement' | translate }}</span>
                  <span class="gl-card-val" [class.text-success]="gl.totalDebit > gl.totalCredit" [class.text-danger]="gl.totalCredit > gl.totalDebit">
                    {{ (gl.totalDebit - gl.totalCredit) | number:'1.2-2' }} AED
                  </span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'accounting.closingBalance' | translate }}</span>
                  <span class="gl-card-val font-weight-bold" style="color: #2563eb;">{{ gl.closingBalance | number:'1.2-2' }} AED</span>
                </div>
              </div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 120px;">{{ 'common.date' | translate }}</th>
                <th style="width: 130px;">{{ 'accounting.voucherNo' | translate }}</th>
                <th style="width: 130px;">{{ 'common.reference' | translate }}</th>
                <th>{{ 'common.description' | translate }}</th>
                <th class="text-right" style="width: 130px;">{{ 'accounting.debit' | translate }} (AED)</th>
                <th class="text-right" style="width: 130px;">{{ 'accounting.credit' | translate }} (AED)</th>
                <th class="text-right" style="width: 150px;">{{ 'accounting.runningBalance' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="subtotal-row">
                <td colspan="4"><em>{{ 'reports.openingBalanceAsOf' | translate:{ date: (gl.fromDate | date:'dd-MMM-yyyy') } }}</em></td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right font-weight-bold">{{ gl.openingBalance | number:'1.2-2' }}</td>
              </tr>
              <tr *ngFor="let line of gl.lines">
                <td>{{ line.date | date:'dd-MMM-yyyy' }}</td>
                <td><span class="acc-code">{{ line.entryNo }}</span></td>
                <td>{{ line.reference || '-' }}</td>
                <td>{{ line.description || '-' }}</td>
                <td class="text-right">{{ line.debit ? (line.debit | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ line.credit ? (line.credit | number:'1.2-2') : '-' }}</td>
                <td class="text-right font-weight-bold">{{ line.runningBalance | number:'1.2-2' }}</td>
              </tr>
              <tr *ngIf="!gl.lines || gl.lines.length === 0">
                <td colspan="7" class="text-center text-muted" style="padding: 2rem;">{{ 'accounting.noTransactionsPeriod' | translate }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="grandtotal-row">
                <td colspan="4">{{ 'reports.totalActivityClosing' | translate }}</td>
                <td class="text-right font-weight-bold">{{ gl.totalDebit | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ gl.totalCredit | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold" style="color: #2563eb;">{{ gl.closingBalance | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 9. AR AGEING (RECEIVABLES) -->
        <div *ngIf="reportType() === 'ar-ageing' && arAgeingData() as ar" class="report-content">
          <div class="report-heading">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3>{{ 'reports.arAgeingTitle' | translate }}</h3>
                <p>{{ 'reports.outstandingArAsOf' | translate:{ date: (ar.asOfDate | date:'dd-MMM-yyyy') } }}</p>
              </div>
              <div class="gl-summary-cards">
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.currentDays' | translate }}</span>
                  <span class="gl-card-val text-success">{{ ar.totalCurrent | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.overdue1To60' | translate }}</span>
                  <span class="gl-card-val" style="color: #d97706;">{{ (ar.total1To30 + ar.total31To60) | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.overdueOver60' | translate }}</span>
                  <span class="gl-card-val text-danger">{{ (ar.total61To90 + ar.totalOver90) | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.grandTotalAr' | translate }}</span>
                  <span class="gl-card-val font-weight-bold" style="color: #2563eb;">{{ ar.grandTotal | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 120px;">{{ 'common.code' | translate }}</th>
                <th>{{ 'sales.customer' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.current' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days1To30' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days31To60' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days61To90' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.daysOver90' | translate }}</th>
                <th class="text-right" style="width: 140px;">{{ 'reports.totalDue' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of ar.customers">
                <td><span class="acc-code">{{ c.customerCode }}</span></td>
                <td><strong>{{ c.customerName }}</strong></td>
                <td class="text-right">{{ c.current ? (c.current | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ c.days1To30 ? (c.days1To30 | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ c.days31To60 ? (c.days31To60 | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ c.days61To90 ? (c.days61To90 | number:'1.2-2') : '-' }}</td>
                <td class="text-right" [class.text-danger]="c.daysOver90 > 0">{{ c.daysOver90 ? (c.daysOver90 | number:'1.2-2') : '-' }}</td>
                <td class="text-right font-weight-bold">{{ c.totalOutstanding | number:'1.2-2' }}</td>
              </tr>
              <tr *ngIf="!ar.customers || ar.customers.length === 0">
                <td colspan="8" class="text-center text-muted" style="padding: 2rem;">{{ 'reports.noOutstandingInvoices' | translate:{ date: (ar.asOfDate | date:'dd-MMM-yyyy') } }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="grandtotal-row">
                <td colspan="2">{{ 'reports.totalReceivables' | translate }}</td>
                <td class="text-right font-weight-bold">{{ ar.totalCurrent | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ar.total1To30 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ar.total31To60 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ar.total61To90 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold text-danger">{{ ar.totalOver90 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold" style="color: #2563eb;">{{ ar.grandTotal | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 10. AP AGEING (PAYABLES) -->
        <div *ngIf="reportType() === 'ap-ageing' && apAgeingData() as ap" class="report-content">
          <div class="report-heading">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3>{{ 'reports.apAgeingTitle' | translate }}</h3>
                <p>{{ 'reports.outstandingApAsOf' | translate:{ date: (ap.asOfDate | date:'dd-MMM-yyyy') } }}</p>
              </div>
              <div class="gl-summary-cards">
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.currentDays' | translate }}</span>
                  <span class="gl-card-val text-success">{{ ap.totalCurrent | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.overdue1To60' | translate }}</span>
                  <span class="gl-card-val" style="color: #d97706;">{{ (ap.total1To30 + ap.total31To60) | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.overdueOver60' | translate }}</span>
                  <span class="gl-card-val text-danger">{{ (ap.total61To90 + ap.totalOver90) | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'reports.grandTotalAp' | translate }}</span>
                  <span class="gl-card-val font-weight-bold" style="color: #ef4444;">{{ ap.grandTotal | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 120px;">{{ 'common.code' | translate }}</th>
                <th>{{ 'purchases.vendor' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.current' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days1To30' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days31To60' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.days61To90' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'reports.daysOver90' | translate }}</th>
                <th class="text-right" style="width: 140px;">{{ 'reports.totalDue' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of ap.vendors">
                <td><span class="acc-code">{{ v.vendorCode }}</span></td>
                <td><strong>{{ v.vendorName }}</strong></td>
                <td class="text-right">{{ v.current ? (v.current | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ v.days1To30 ? (v.days1To30 | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ v.days31To60 ? (v.days31To60 | number:'1.2-2') : '-' }}</td>
                <td class="text-right">{{ v.days61To90 ? (v.days61To90 | number:'1.2-2') : '-' }}</td>
                <td class="text-right" [class.text-danger]="v.daysOver90 > 0">{{ v.daysOver90 ? (v.daysOver90 | number:'1.2-2') : '-' }}</td>
                <td class="text-right font-weight-bold">{{ v.totalOutstanding | number:'1.2-2' }}</td>
              </tr>
              <tr *ngIf="!ap.vendors || ap.vendors.length === 0">
                <td colspan="8" class="text-center text-muted" style="padding: 2rem;">{{ 'reports.noOutstandingBills' | translate:{ date: (ap.asOfDate | date:'dd-MMM-yyyy') } }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="grandtotal-row">
                <td colspan="2">{{ 'reports.totalPayables' | translate }}</td>
                <td class="text-right font-weight-bold">{{ ap.totalCurrent | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ap.total1To30 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ap.total31To60 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold">{{ ap.total61To90 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold text-danger">{{ ap.totalOver90 | number:'1.2-2' }}</td>
                <td class="text-right font-weight-bold" style="color: #ef4444;">{{ ap.grandTotal | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 11. STOCK MOVEMENT LEDGER -->
        <div *ngIf="reportType() === 'stock-movement' && stockMovementData() as sm" class="report-content">
          <div class="report-heading">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3>{{ 'reports.stockMovementTitle' | translate }} &mdash; {{ sm.sku }} {{ sm.itemName }}</h3>
                <p>{{ 'reports.filterPeriod' | translate }}: {{ sm.fromDate | date:'dd-MMM-yyyy' }} - {{ sm.toDate | date:'dd-MMM-yyyy' }}</p>
              </div>
              <div class="gl-summary-cards">
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'inventory.openingQty' | translate }}</span>
                  <span class="gl-card-val">{{ sm.openingQty | number:'1.2-2' }}</span>
                </div>
                <div class="gl-card">
                  <span class="gl-card-label">{{ 'inventory.closingQty' | translate }}</span>
                  <span class="gl-card-val font-weight-bold" style="color: #2563eb;">{{ sm.closingQty | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 120px;">{{ 'common.date' | translate }}</th>
                <th style="width: 140px;">{{ 'inventory.movementType' | translate }}</th>
                <th style="width: 140px;">{{ 'common.reference' | translate }}</th>
                <th>{{ 'inventory.warehouse' | translate }}</th>
                <th class="text-right" style="width: 110px;">{{ 'inventory.qtyIn' | translate }}</th>
                <th class="text-right" style="width: 110px;">{{ 'inventory.qtyOut' | translate }}</th>
                <th class="text-right" style="width: 130px;">{{ 'inventory.runningBalance' | translate }}</th>
                <th class="text-right" style="width: 120px;">{{ 'common.unitPrice' | translate }} (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="subtotal-row">
                <td colspan="4"><em>{{ 'inventory.openingStockAsOf' | translate:{ date: (sm.fromDate | date:'dd-MMM-yyyy') } }}</em></td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right font-weight-bold">{{ sm.openingQty | number:'1.2-2' }}</td>
                <td class="text-right">-</td>
              </tr>
              <tr *ngFor="let m of sm.movements">
                <td>{{ m.date | date:'dd-MMM-yyyy' }}</td>
                <td><span class="type-pill">{{ m.movementType }}</span></td>
                <td><span class="acc-code">{{ m.reference || '-' }}</span></td>
                <td>{{ m.warehouseName || '-' }}</td>
                <td class="text-right text-success">{{ m.qtyIn ? ('+' + (m.qtyIn | number:'1.2-2')) : '-' }}</td>
                <td class="text-right text-danger">{{ m.qtyOut ? ('-' + (m.qtyOut | number:'1.2-2')) : '-' }}</td>
                <td class="text-right font-weight-bold">{{ m.runningBalance | number:'1.2-2' }}</td>
                <td class="text-right">{{ m.unitCost ? (m.unitCost | number:'1.2-2') : '-' }}</td>
              </tr>
              <tr *ngIf="!sm.movements || sm.movements.length === 0">
                <td colspan="8" class="text-center text-muted" style="padding: 2rem;">{{ 'inventory.noStockMovements' | translate }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="grandtotal-row">
                <td colspan="6">{{ 'inventory.closingStockQty' | translate }}</td>
                <td class="text-right font-weight-bold" style="color: #2563eb;">{{ sm.closingQty | number:'1.2-2' }}</td>
                <td colspan="1"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 12. GENERIC FALLBACK (FOR ANY UNMAPPED REPORTS) -->
        <div *ngIf="genericTableData() as gen" class="report-content">
          <div class="report-heading">
            <h3>{{ reportTitleKey() | translate }}</h3>
          </div>
          <pre class="json-preview">{{ gen | json }}</pre>
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
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .report-content {
      width: 100%;
      min-width: 600px;
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
      min-width: 600px;
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
    .gl-summary-cards { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .gl-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.85rem; display: flex; flex-direction: column; min-width: 120px; }
    .gl-card-label { font-size: 0.6875rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .gl-card-val { font-size: 1rem; font-weight: 700; color: #0f172a; margin-top: 0.15rem; }
    .type-pill { display: inline-block; padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: #e0e7ff; color: #3730a3; }
    .json-preview { background: #f8fafc; padding: 1rem; border-radius: 6px; font-size: 0.8125rem; overflow-x: auto; }

    @media (max-width: 767px) {
      .report-viewer-page {
        padding: 0.75rem;
      }
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .filter-actions {
        width: 100%;
      }
      .filter-actions .btn {
        flex: 1;
        justify-content: center;
      }
      .report-table {
        min-width: 600px;
      }
      .table-card {
        overflow-x: auto;
      }
    }
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

  reportType = signal<string>('profit-loss');
  reportTitle = signal<string>('Profit & Loss Statement');
  readonly reportTitleKey = computed(() => {
    const type = this.reportType();
    const keyMap: Record<string, string> = {
      'profit-loss': 'reports.profitLossTitle',
      'balance-sheet': 'reports.balanceSheetTitle',
      'general-ledger': 'reports.generalLedgerTitle',
      'trial-balance': 'reports.trialBalanceTitle',
      'ar-ageing': 'reports.arAgeingTitle',
      'ap-ageing': 'reports.apAgeingTitle',
      'vat-return': 'reports.vatReturnTitle',
      'stock-valuation': 'reports.stockValuationTitle',
      'stock-movement': 'reports.stockMovementTitle',
      'pipeline-forecast': 'reports.pipelineForecastTitle',
      'expense-analysis': 'reports.expenseAnalysisTitle'
    };
    return keyMap[type] || 'nav.reports';
  });
  loading = signal<boolean>(false);

  // Filter models
  fromDate = signal<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  toDate = signal<string>(new Date().toISOString().split('T')[0]);
  asOfDate = signal<string>(new Date().toISOString().split('T')[0]);
  comparePeriod = signal<string>('');
  selectedCostCenterId = signal<number | null>(null);
  selectedAccountId = signal<number | null>(null);
  selectedWarehouseId = signal<number | null>(null);
  selectedItemId = signal<number | null>(null);
  expenseGroupBy = signal<string>('category');

  // Catalogs
  accounts = signal<Account[]>([]);
  costCenters = signal<CostCenter[]>([]);
  warehouses = signal<any[]>([]);
  items = signal<Item[]>([]);

  // Report payloads
  profitLossData = signal<ProfitLossReport | null>(null);
  balanceSheetData = signal<BalanceSheetReport | null>(null);
  vatReturnData = signal<VatReturnReport | null>(null);
  stockValuationData = signal<StockValuationReport | null>(null);
  pipelineData = signal<PipelineForecastReport | null>(null);
  expenseData = signal<ExpenseAnalysisReport | null>(null);
  trialBalanceData = signal<TrialBalanceReport | null>(null);
  generalLedgerData = signal<GeneralLedgerReport | null>(null);
  arAgeingData = signal<ArAgeingReport | null>(null);
  apAgeingData = signal<ApAgeingReport | null>(null);
  stockMovementData = signal<StockMovementReport | null>(null);
  genericTableData = signal<any>(null);

  readonly usesDateRange = computed(() =>
    ['profit-loss', 'vat-return', 'general-ledger', 'stock-movement', 'pipeline-forecast', 'expense-analysis'].includes(this.reportType())
  );

  readonly usesAsOfDate = computed(() =>
    ['balance-sheet', 'trial-balance', 'ar-ageing', 'ap-ageing', 'stock-valuation'].includes(this.reportType())
  );

  ngOnInit(): void {
    this.route.queryParams.subscribe(qp => {
      if (qp['accountId']) {
        this.selectedAccountId.set(Number(qp['accountId']));
      }
      if (qp['from']) {
        this.fromDate.set(qp['from']);
      }
      if (qp['to']) {
        this.toDate.set(qp['to']);
      }
      if (qp['itemId']) {
        this.selectedItemId.set(Number(qp['itemId']));
      }
    });

    this.route.params.subscribe(params => {
      if (params['type']) {
        this.reportType.set(params['type']);
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
    this.reportTitle.set(titles[this.reportType()] || 'Financial Report');
  }

  switchReportType(type: string): void {
    this.router.navigate(['/reports', type]);
  }

  loadCatalogs(): void {
    this.costCenterService.getCostCenters().subscribe({
      next: (res) => this.costCenters.set(res),
      error: () => {}
    });
    this.accountService.getAccounts().subscribe({
      next: (res: any) => {
        const accList = res?.content || (Array.isArray(res) ? res : []);
        this.accounts.set(accList);
        if (accList.length > 0 && !this.selectedAccountId()) {
          this.selectedAccountId.set(accList[0].id);
          if (this.reportType() === 'general-ledger' && !this.generalLedgerData()) {
            this.loadReport();
          }
        }
      },
      error: () => {}
    });
    this.inventoryService.getWarehouses().subscribe({
      next: (res) => this.warehouses.set(res),
      error: () => {}
    });
    this.inventoryService.getItems({ size: 100, active: true }).subscribe({
      next: (res) => {
        const itemList = res?.content || (Array.isArray(res) ? res : []);
        this.items.set(itemList);
        if (itemList.length > 0 && !this.selectedItemId()) {
          this.selectedItemId.set(itemList[0].id);
          if (this.reportType() === 'stock-movement' && !this.stockMovementData()) {
            this.loadReport();
          }
        }
      },
      error: () => {}
    });
  }

  loadReport(): void {
    this.loading.set(true);
    this.resetData();

    const type = this.reportType();
    switch (type) {
      case 'profit-loss':
        this.reportService.getProfitLoss(this.fromDate(), this.toDate(), this.comparePeriod(), this.selectedCostCenterId() || undefined).subscribe({
          next: (res) => { this.profitLossData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'balance-sheet':
        this.reportService.getBalanceSheet(this.asOfDate(), this.comparePeriod()).subscribe({
          next: (res) => { this.balanceSheetData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'vat-return':
        this.reportService.getVatReturn(this.fromDate(), this.toDate()).subscribe({
          next: (res) => { this.vatReturnData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'stock-valuation':
        this.reportService.getStockValuation(this.asOfDate(), this.selectedWarehouseId() || undefined).subscribe({
          next: (res) => { this.stockValuationData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'pipeline-forecast':
        this.reportService.getPipelineForecast(this.fromDate(), this.toDate()).subscribe({
          next: (res) => { this.pipelineData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'expense-analysis':
        this.reportService.getExpenseAnalysis(this.fromDate(), this.toDate(), this.expenseGroupBy()).subscribe({
          next: (res) => { this.expenseData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'general-ledger': {
        const accId = this.selectedAccountId();
        if (accId) {
          this.reportService.getGeneralLedger(accId, this.fromDate(), this.toDate()).subscribe({
            next: (res) => { this.generalLedgerData.set(res); this.loading.set(false); },
            error: (err) => this.handleError(err)
          });
        } else {
          this.loading.set(false);
        }
        break;
      }
      case 'trial-balance':
        this.reportService.getTrialBalance(this.asOfDate()).subscribe({
          next: (res) => { this.trialBalanceData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'ar-ageing':
        this.reportService.getArAgeing(this.asOfDate()).subscribe({
          next: (res) => { this.arAgeingData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'ap-ageing':
        this.reportService.getApAgeing(this.asOfDate()).subscribe({
          next: (res) => { this.apAgeingData.set(res); this.loading.set(false); },
          error: (err) => this.handleError(err)
        });
        break;
      case 'stock-movement': {
        const itemId = this.selectedItemId();
        if (itemId) {
          this.reportService.getStockMovement(itemId, this.fromDate(), this.toDate()).subscribe({
            next: (res) => { this.stockMovementData.set(res); this.loading.set(false); },
            error: (err) => this.handleError(err)
          });
        } else {
          this.loading.set(false);
        }
        break;
      }
      default:
        this.loading.set(false);
    }
  }

  drillDownGl(accountId: number): void {
    this.router.navigate(['/reports', 'general-ledger'], {
      queryParams: { accountId, from: this.fromDate(), to: this.toDate() }
    });
  }

  handleExport(format: 'pdf' | 'xlsx'): void {
    this.loading.set(true);
    const params: Record<string, string> = {
      from: this.fromDate(),
      to: this.toDate(),
      asOf: this.asOfDate()
    };
    const compare = this.comparePeriod();
    const ccId = this.selectedCostCenterId();
    if (compare) params['compare'] = compare;
    if (ccId) params['costCenterId'] = ccId.toString();
    if (this.selectedAccountId()) params['accountId'] = this.selectedAccountId()!.toString();
    if (this.selectedItemId()) params['itemId'] = this.selectedItemId()!.toString();
    if (this.selectedWarehouseId()) params['warehouseId'] = this.selectedWarehouseId()!.toString();
    if (this.reportType() === 'expense-analysis' && this.expenseGroupBy()) {
      params['groupBy'] = this.expenseGroupBy();
    }

    const type = this.reportType();
    this.reportService.exportReport(type, format, params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.loading.set(false);
        this.notificationService.success(`Report exported successfully as ${format.toUpperCase()}`);
      },
      error: () => {
        this.loading.set(false);
        this.notificationService.error('Export failed');
      }
    });
  }

  private resetData(): void {
    this.profitLossData.set(null);
    this.balanceSheetData.set(null);
    this.vatReturnData.set(null);
    this.stockValuationData.set(null);
    this.pipelineData.set(null);
    this.expenseData.set(null);
    this.trialBalanceData.set(null);
    this.generalLedgerData.set(null);
    this.arAgeingData.set(null);
    this.apAgeingData.set(null);
    this.stockMovementData.set(null);
    this.genericTableData.set(null);
  }

  private handleError(err: any): void {
    this.loading.set(false);
    this.notificationService.error(err.error?.message || 'Failed to load report data');
  }
}
