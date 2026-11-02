import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { GeneralLedgerReport } from '../../../core/models/report.model';

@Injectable({
  providedIn: 'root'
})
export class LedgerService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/reports`;

  getGeneralLedgerReport(accountId: number, from?: string, to?: string): Observable<GeneralLedgerReport> {
    let params = new HttpParams().set('accountId', accountId.toString());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    return this.http.get<GeneralLedgerReport>(`${this.base}/general-ledger`, { params });
  }
}

