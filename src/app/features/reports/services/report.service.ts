import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DashboardSummary,
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
} from '../../../core/models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private baseReports = `${environment.apiBaseUrl}/reports`;
  private baseDashboard = `${environment.apiBaseUrl}/dashboard`;

  getDashboardSummary(from?: string, to?: string): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<DashboardSummary>(`${this.baseDashboard}/summary`, { params });
  }

  getProfitLoss(from?: string, to?: string, compare?: string, costCenterId?: number): Observable<ProfitLossReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (compare) params = params.set('compare', compare);
    if (costCenterId) params = params.set('costCenterId', costCenterId.toString());
    return this.http.get<ProfitLossReport>(`${this.baseReports}/profit-loss`, { params });
  }

  getBalanceSheet(asOf?: string, compare?: string): Observable<BalanceSheetReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    if (compare) params = params.set('compare', compare);
    return this.http.get<BalanceSheetReport>(`${this.baseReports}/balance-sheet`, { params });
  }

  getGeneralLedger(accountId: number, from?: string, to?: string): Observable<GeneralLedgerReport> {
    let params = new HttpParams().set('accountId', accountId.toString());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<GeneralLedgerReport>(`${this.baseReports}/general-ledger`, { params });
  }

  getTrialBalance(asOf?: string): Observable<TrialBalanceReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    return this.http.get<TrialBalanceReport>(`${this.baseReports}/trial-balance`, { params });
  }

  getArAgeing(asOf?: string): Observable<ArAgeingReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    return this.http.get<ArAgeingReport>(`${this.baseReports}/ar-ageing`, { params });
  }

  getApAgeing(asOf?: string): Observable<ApAgeingReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    return this.http.get<ApAgeingReport>(`${this.baseReports}/ap-ageing`, { params });
  }

  getVatReturn(from?: string, to?: string): Observable<VatReturnReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<VatReturnReport>(`${this.baseReports}/vat-return`, { params });
  }

  getStockValuation(asOf?: string, warehouseId?: number): Observable<StockValuationReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());
    return this.http.get<StockValuationReport>(`${this.baseReports}/stock-valuation`, { params });
  }

  getStockMovement(itemId: number, from?: string, to?: string): Observable<StockMovementReport> {
    let params = new HttpParams().set('itemId', itemId.toString());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<StockMovementReport>(`${this.baseReports}/stock-movement`, { params });
  }

  getPipelineForecast(from?: string, to?: string, ownerId?: number): Observable<PipelineForecastReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (ownerId) params = params.set('ownerId', ownerId.toString());
    return this.http.get<PipelineForecastReport>(`${this.baseReports}/pipeline-forecast`, { params });
  }

  getExpenseAnalysis(from?: string, to?: string, groupBy?: string): Observable<ExpenseAnalysisReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (groupBy) params = params.set('groupBy', groupBy);
    return this.http.get<ExpenseAnalysisReport>(`${this.baseReports}/expense-analysis`, { params });
  }

  exportReport(type: string, format: 'pdf' | 'xlsx', additionalParams?: Record<string, string>): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    if (additionalParams) {
      Object.keys(additionalParams).forEach(k => {
        if (additionalParams[k]) {
          params = params.set(k, additionalParams[k]);
        }
      });
    }
    return this.http.get(`${this.baseReports}/${type}/export`, {
      params,
      responseType: 'blob'
    });
  }
}

