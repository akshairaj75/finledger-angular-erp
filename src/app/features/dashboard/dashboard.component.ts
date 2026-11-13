import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { DashboardSummary } from '../../core/models/report.model';
import { NotificationService } from '../../core/services/notification.service';
import { ReportService } from '../reports/services/report.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  template: `
    <div class="dashboard-page">
      <!-- Welcome & Action Bar -->
      <div class="dashboard-header">
        <div>
          <h2>Executive Financial & Operational Dashboard</h2>
          <p class="subtitle">Real-time consolidated view across Ledger, Sales, Purchases, CRM, and Inventory</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="loadDashboardData()" [disabled]="loading()">
            🔄 Refresh Metrics
          </button>
          <a *appHasPermission="'REPORT_VIEW'" routerLink="/reports/profit-loss" class="btn btn-primary">
            📈 View Full Reports
          </a>
        </div>
      </div>

      <div *ngIf="loading() && !summary()" class="loading-state">
        <div class="spinner"></div>
        <span>Consolidating enterprise metrics...</span>
      </div>

      <div *ngIf="summary() as s" class="dashboard-content">
        <!-- ROW 1: Financial KPI Cards (Hidden if user lacks financial visibility) -->
        <ng-container *appHasPermission="['REPORT_VIEW', 'LEDGER_VIEW', 'JOURNAL_VIEW']">
          <div class="section-title">
            <span>Financial Performance (YTD)</span>
          </div>
          <div class="kpi-grid financial-grid">
          <div class="kpi-card revenue-card">
            <div class="kpi-icon-box bg-blue">💰</div>
            <div class="kpi-meta">
              <span class="kpi-label">Total Revenue (YTD)</span>
              <span class="kpi-value">{{ s.totalRevenueYtd | number:'1.2-2' }} <span class="currency">AED</span></span>
              <span class="kpi-hint text-success">↑ Operating Income</span>
            </div>
          </div>

          <div class="kpi-card expenses-card">
            <div class="kpi-icon-box bg-red">📉</div>
            <div class="kpi-meta">
              <span class="kpi-label">Total Expenses (YTD)</span>
              <span class="kpi-value">{{ s.totalExpensesYtd | number:'1.2-2' }} <span class="currency">AED</span></span>
              <span class="kpi-hint text-muted">Operating & Direct</span>
            </div>
          </div>

          <div class="kpi-card ar-card">
            <div class="kpi-icon-box bg-amber">🧾</div>
            <div class="kpi-meta">
              <span class="kpi-label">Accounts Receivable</span>
              <span class="kpi-value">{{ s.accountsReceivable | number:'1.2-2' }} <span class="currency">AED</span></span>
              <a routerLink="/reports/ar-ageing" class="kpi-hint link-hint">Open Invoices →</a>
            </div>
          </div>

          <div class="kpi-card cash-card">
            <div class="kpi-icon-box bg-green">🏦</div>
            <div class="kpi-meta">
              <span class="kpi-label">Cash & Bank Balances</span>
              <span class="kpi-value">{{ s.cashAndBank | number:'1.2-2' }} <span class="currency">AED</span></span>
              <a routerLink="/banking/reconciliation" class="kpi-hint link-hint">Reconciliation →</a>
            </div>
          </div>

          <div class="kpi-card ap-card">
            <div class="kpi-icon-box bg-purple">📥</div>
            <div class="kpi-meta">
              <span class="kpi-label">Accounts Payable</span>
              <span class="kpi-value">{{ s.accountsPayable | number:'1.2-2' }} <span class="currency">AED</span></span>
              <a routerLink="/reports/ap-ageing" class="kpi-hint link-hint">Vendor Bills →</a>
            </div>
          </div>
        </div>
        </ng-container>

        <!-- ROW 2: Operational KPI Cards -->
        <div class="section-title mt-4" *appHasPermission="['OPPORTUNITY_VIEW', 'CRM_VIEW_ALL', 'ITEM_VIEW', 'EXPENSE_VIEW', 'EXPENSE_APPROVE']">
          <span>Operational Efficiency & Pipeline</span>
        </div>
        <div class="kpi-grid operational-grid">
          <div class="kpi-card pipeline-card" *appHasPermission="['OPPORTUNITY_VIEW', 'CRM_VIEW_ALL']">
            <div class="kpi-icon-box bg-indigo">🎯</div>
            <div class="kpi-meta">
              <span class="kpi-label">Open CRM Pipeline</span>
              <span class="kpi-value">{{ s.openPipelineValue | number:'1.2-2' }} <span class="currency">AED</span></span>
              <span class="kpi-hint font-weight-bold">{{ s.openPipelineCount }} active opportunities</span>
            </div>
          </div>

          <div class="kpi-card stock-card" *appHasPermission="'ITEM_VIEW'">
            <div class="kpi-icon-box bg-teal">📦</div>
            <div class="kpi-meta">
              <span class="kpi-label">Inventory Valuation</span>
              <span class="kpi-value">{{ s.totalInventoryValue | number:'1.2-2' }} <span class="currency">AED</span></span>
              <span class="kpi-hint" [ngClass]="s.lowStockItemCount > 0 ? 'text-danger' : 'text-success'">
                {{ s.lowStockItemCount > 0 ? '⚠ ' + s.lowStockItemCount + ' items below reorder' : '✓ Stock levels healthy' }}
              </span>
            </div>
          </div>

          <div class="kpi-card approval-card" *appHasPermission="['EXPENSE_APPROVE', 'EXPENSE_VIEW']">
            <div class="kpi-icon-box bg-orange">⏳</div>
            <div class="kpi-meta">
              <span class="kpi-label">Awaiting Expense Approval</span>
              <span class="kpi-value">{{ s.expensesAwaitingApprovalAmount | number:'1.2-2' }} <span class="currency">AED</span></span>
              <span class="kpi-hint text-warning font-weight-bold">{{ s.expensesAwaitingApprovalCount }} pending claims</span>
            </div>
          </div>

          <div class="kpi-card approval-card" *ngIf="(s.overdueActivitiesCount ?? 0) > 0">
            <div class="kpi-icon-box bg-red">⏰</div>
            <div class="kpi-meta">
              <span class="kpi-label">Overdue CRM Tasks</span>
              <span class="kpi-value">{{ s.overdueActivitiesCount }}</span>
              <span class="kpi-hint text-danger font-weight-bold">Require immediate follow-up</span>
            </div>
          </div>
        </div>

        <!-- Visualizations Grid (Gated by REPORT_VIEW / LEDGER_VIEW) -->
        <div class="analytics-grid mt-4" *appHasPermission="['REPORT_VIEW', 'LEDGER_VIEW']">
          <!-- 6-Month Revenue vs Expenses Visual Chart -->
          <div class="card chart-card">
            <div class="card-header">
              <h3>Monthly Revenue vs. Expenses</h3>
              <span class="badge badge-light">Last 6 Months</span>
            </div>
            <div class="chart-container">
              <div class="chart-bars">
                <div class="month-column" *ngFor="let m of s.monthlyRevenueExpenses">
                  <div class="bars-pair">
                    <!-- Revenue bar -->
                    <div
                      class="bar bar-revenue"
                      [style.height.%]="getBarHeight(m.revenue)"
                      [title]="'Revenue: ' + (m.revenue | number:'1.2-2') + ' AED'"
                    ></div>
                    <!-- Expense bar -->
                    <div
                      class="bar bar-expense"
                      [style.height.%]="getBarHeight(m.expenses)"
                      [title]="'Expenses: ' + (m.expenses | number:'1.2-2') + ' AED'"
                    ></div>
                  </div>
                  <div class="month-label">{{ m.month }}</div>
                </div>
              </div>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-color legend-revenue"></span> Revenue</span>
                <span class="legend-item"><span class="legend-color legend-expense"></span> Expenses</span>
              </div>
            </div>
          </div>

          <!-- Receivables Ageing Breakdown -->
          <div class="card ageing-card">
            <div class="card-header">
              <h3>Receivables Ageing Buckets</h3>
              <a routerLink="/reports/ar-ageing" class="view-link">View Report →</a>
            </div>
            <div class="ageing-content">
              <div class="ageing-total">
                <span class="total-label">Total Outstanding AR</span>
                <span class="total-val">{{ s.receivablesAgeing.total | number:'1.2-2' }} AED</span>
              </div>
              <div class="ageing-buckets">
                <div class="bucket-row">
                  <span class="bucket-name">Current (Not Overdue)</span>
                  <span class="bucket-val text-success">{{ s.receivablesAgeing.current | number:'1.2-2' }}</span>
                </div>
                <div class="bucket-row">
                  <span class="bucket-name">1 — 30 Days Overdue</span>
                  <span class="bucket-val">{{ s.receivablesAgeing.days1To30 | number:'1.2-2' }}</span>
                </div>
                <div class="bucket-row">
                  <span class="bucket-name">31 — 60 Days Overdue</span>
                  <span class="bucket-val text-warning">{{ s.receivablesAgeing.days31To60 | number:'1.2-2' }}</span>
                </div>
                <div class="bucket-row">
                  <span class="bucket-name">61 — 90 Days Overdue</span>
                  <span class="bucket-val text-orange">{{ s.receivablesAgeing.days61To90 | number:'1.2-2' }}</span>
                </div>
                <div class="bucket-row">
                  <span class="bucket-name">> 90 Days (Critical)</span>
                  <span class="bucket-val text-danger">{{ s.receivablesAgeing.over90 | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Transactions Table -->
        <div class="card transactions-card mt-4" *appHasPermission="['JOURNAL_VIEW', 'LEDGER_VIEW', 'REPORT_VIEW']">
          <div class="card-header">
            <h3>Recent Financial Transactions</h3>
            <span class="badge badge-light">Latest 10 Journal & Voucher Postings</span>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source / Type</th>
                  <th>Reference #</th>
                  <th>Narration / Details</th>
                  <th class="text-right">Amount (AED)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tx of s.recentTransactions">
                  <td>{{ tx.date }}</td>
                  <td><span class="type-pill">{{ tx.type }}</span></td>
                  <td><strong>{{ tx.reference }}</strong></td>
                  <td>{{ tx.description || '-' }}</td>
                  <td class="text-right font-weight-bold">{{ tx.amount | number:'1.2-2' }}</td>
                  <td><span class="status-pill status-posted">{{ tx.status }}</span></td>
                </tr>
                <tr *ngIf="s.recentTransactions.length === 0">
                  <td colspan="6" class="text-center text-muted py-3">No posted transactions recorded yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .dashboard-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }

    .subtitle {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .section-title {
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      border-left: 3px solid #2563eb;
      padding-left: 0.5rem;
    }

    .kpi-grid {
      display: grid;
      gap: 1rem;
    }

    .financial-grid {
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }

    .operational-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.15rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .kpi-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .bg-blue { background: #dbeafe; }
    .bg-red { background: #fee2e2; }
    .bg-amber { background: #fef3c7; }
    .bg-green { background: #dcfce7; }
    .bg-purple { background: #f3e8ff; }
    .bg-indigo { background: #e0e7ff; }
    .bg-teal { background: #ccfbf1; }
    .bg-orange { background: #ffedd5; }

    .kpi-meta {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .kpi-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .kpi-value {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
      margin: 0.2rem 0;
    }

    .currency {
      font-size: 0.75rem;
      font-weight: 500;
      color: #94a3b8;
    }

    .kpi-hint {
      font-size: 0.75rem;
    }

    .link-hint {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }

    .link-hint:hover {
      text-decoration: underline;
    }

    .analytics-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 1024px) {
      .analytics-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .card-header {
      padding: 0.85rem 1.25rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }

    .chart-container {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .chart-bars {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: 220px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }

    .month-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .bars-pair {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 180px;
    }

    .bar {
      width: 16px;
      border-radius: 4px 4px 0 0;
      transition: height 0.3s ease;
      min-height: 4px;
    }

    .bar-revenue {
      background: #2563eb;
    }

    .bar-expense {
      background: #ef4444;
    }

    .month-label {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
    }

    .chart-legend {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #475569;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .legend-revenue { background: #2563eb; }
    .legend-expense { background: #ef4444; }

    .ageing-content {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ageing-total {
      background: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
    }

    .total-val {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f172a;
    }

    .ageing-buckets {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .bucket-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
      padding: 0.35rem 0;
      border-bottom: 1px dashed #e2e8f0;
    }

    .bucket-name {
      color: #475569;
    }

    .bucket-val {
      font-weight: 700;
    }

    .view-link {
      font-size: 0.8125rem;
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }

    .table-wrapper {
      max-height: 400px;
      overflow-y: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .table th {
      background: #f8fafc;
      padding: 0.65rem 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .type-pill {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #475569;
    }

    .status-posted {
      background: #dcfce7;
      color: #166534;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
    }

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
      text-decoration: none;
    }

    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #0284c7; color: #fff; }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      gap: 1rem;
      color: #64748b;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .mt-4 { margin-top: 1.5rem; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .text-warning { color: #f59e0b; }
    .text-orange { color: #ea580c; }
    .text-muted { color: #94a3b8; }
    .font-weight-bold { font-weight: 700; }
  `]
})
export class DashboardComponent implements OnInit {
  private reportService = inject(ReportService);
  private notificationService = inject(NotificationService);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    this.reportService.getDashboardSummary().subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getBarHeight(val: number): number {
    const s = this.summary();
    if (!s || !s.monthlyRevenueExpenses.length) return 5;
    const maxVal = Math.max(
      ...s.monthlyRevenueExpenses.map(m => Math.max(m.revenue, m.expenses)),
      1000
    );
    const pct = (val / maxVal) * 100;
    return Math.max(Math.min(pct, 100), 5);
  }
}

